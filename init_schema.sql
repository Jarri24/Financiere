-- ========================================================
-- FINANCIERE APP - ESQUEMA DE BASE DE DATOS PERSONAL
-- Usuario: Jarinson Castro
-- Basado en: BalanceJarinson_2026.xlsx
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: CUENTAS
CREATE TABLE IF NOT EXISTS cuentas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    institucion VARCHAR(50) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
    saldo_actual NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    activo BOOLEAN NOT NULL DEFAULT true,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
    grupo VARCHAR(50) NOT NULL,
    icono VARCHAR(50) DEFAULT 'wallet',
    color VARCHAR(20) DEFAULT '#3B82F6',
    es_fijo BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: TRANSACCIONES
CREATE TABLE IF NOT EXISTS transacciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'gasto', 'transferencia')),
    monto NUMERIC(12, 2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
    tipo_cambio NUMERIC(8, 4) DEFAULT 1.0000,
    cuenta_origen_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
    cuenta_destino_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    comercio VARCHAR(150),
    descripcion TEXT,
    metodo_pago VARCHAR(50) DEFAULT 'manual',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: PRESTAMOS
CREATE TABLE IF NOT EXISTS prestamos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deudor VARCHAR(100) NOT NULL,
    monto_prestado NUMERIC(12, 2) NOT NULL,
    tasa_mensual NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    fecha_inicio DATE,
    fecha_fin DATE,
    cuotas_totales INT DEFAULT 1,
    cuotas_pagadas INT DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Pagado', 'Vencido', 'Refinanciado')),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: PAGOS PRESTAMO
CREATE TABLE IF NOT EXISTS pagos_prestamo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    monto_capital NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monto_interes NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monto_total NUMERIC(12, 2) GENERATED ALWAYS AS (monto_capital + monto_interes) STORED,
    cuenta_ingreso_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA: PRESUPUESTOS MENSUALES
CREATE TABLE IF NOT EXISTS presupuestos_mensuales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio INT NOT NULL,
    mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    categoria_id UUID REFERENCES categorias(id) ON DELETE CASCADE,
    monto_presupuestado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    pct_ahorro_obligatorio NUMERIC(4, 2) DEFAULT 0.50,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (anio, mes, categoria_id)
);

-- VISTAS ANALITICAS
CREATE OR REPLACE VIEW vista_resumen_patrimonio AS
SELECT 
    c.institucion,
    c.tipo,
    c.moneda,
    SUM(c.saldo_actual) AS total_saldo,
    COUNT(c.id) AS total_cuentas
FROM cuentas c
WHERE c.activo = true
GROUP BY c.institucion, c.tipo, c.moneda;

CREATE OR REPLACE VIEW vista_prestamos_resumen AS
SELECT 
    p.id,
    p.deudor,
    p.monto_prestado,
    (p.tasa_mensual * 100) AS tasa_pct,
    (p.monto_prestado * p.tasa_mensual) AS interes_mensual_estimado,
    p.fecha_inicio,
    p.fecha_fin,
    p.estado,
    COALESCE(SUM(pp.monto_capital), 0) AS capital_recuperado,
    COALESCE(SUM(pp.monto_interes), 0) AS total_intereses_cobrados,
    (p.monto_prestado - COALESCE(SUM(pp.monto_capital), 0)) AS saldo_capital_pendiente
FROM prestamos p
LEFT JOIN pagos_prestamo pp ON p.id = pp.prestamo_id
GROUP BY p.id;

-- SEED DATA: Cuentas
INSERT INTO cuentas (nombre, institucion, tipo, moneda, saldo_actual) VALUES
('SIP DPF Inversion', 'SIP', 'dpf', 'PEN', 70000.00),
('SIP Cuenta Soles', 'SIP', 'ahorros', 'PEN', 11475.47),
('BBVA Cuenta Dolares', 'BBVA', 'ahorros', 'USD', 0.00),
('BBVA Cuenta Soles', 'BBVA', 'ahorros', 'PEN', 0.00),
('BBVA Tarjeta Credito', 'BBVA', 'tarjeta_credito', 'PEN', -5271.75),
('BCP Cuenta Sueldo / Ahorros', 'BCP', 'ahorros', 'PEN', 0.00),
('BCP Tarjeta Credito', 'BCP', 'tarjeta_credito', 'PEN', -7320.58),
('Interbank Ahorros', 'Interbank', 'ahorros', 'PEN', 0.00),
('eToro Cartera Inversiones', 'eToro', 'inversion', 'USD', 25168.77),
('Efectivo Fisico', 'Efectivo', 'ahorros', 'PEN', 0.00);

-- SEED DATA: Categorias
INSERT INTO categorias (nombre, tipo, grupo, icono, color) VALUES
('Ingresos Trabajo (Sueldo)', 'ingreso', 'Laboral', 'briefcase', '#10B981'),
('Intereses Prestamos', 'ingreso', 'Rendimientos', 'trending-up', '#3B82F6'),
('Rendimientos DPF SIP', 'ingreso', 'Rendimientos', 'piggy-bank', '#6366F1'),
('Otros Ingresos', 'ingreso', 'Laboral', 'plus-circle', '#8B5CF6'),
('Terreno Amazonas', 'gasto', 'Proyectos', 'compass', '#F59E0B'),
('Reconstruccion Casa', 'gasto', 'Proyectos', 'home', '#D97706'),
('Especializacion', 'gasto', 'Educacion', 'academic-cap', '#3B82F6'),
('Claude AI', 'gasto', 'Suscripciones', 'sparkles', '#8B5CF6'),
('Google AI', 'gasto', 'Suscripciones', 'cpu-chip', '#6366F1'),
('Apple Music', 'gasto', 'Suscripciones', 'musical-note', '#EC4899'),
('iCloud', 'gasto', 'Suscripciones', 'cloud', '#06B6D4'),
('Money App', 'gasto', 'Suscripciones', 'currency-dollar', '#10B981'),
('Office Mensual', 'gasto', 'Suscripciones', 'document-text', '#EF4444'),
('Yousician', 'gasto', 'Suscripciones', 'play', '#14B8A6'),
('Internet', 'gasto', 'Servicios', 'wifi', '#0284C7'),
('Celular', 'gasto', 'Servicios', 'phone', '#2563EB'),
('Servicios Casa', 'gasto', 'Servicios', 'light-bulb', '#EAB308'),
('Comida Gringo', 'gasto', 'Mascota', 'heart', '#F97316'),
('Bano + Corte Gringo', 'gasto', 'Mascota', 'scissors', '#FB923C'),
('Almuerzos', 'gasto', 'Alimentacion', 'cake', '#EF4444'),
('Pasajes y Transporte', 'gasto', 'Transporte', 'truck', '#64748B'),
('Tarjeta de Credito BBVA', 'gasto', 'Tarjetas', 'credit-card', '#0284C7'),
('Tarjeta de Credito BCP', 'gasto', 'Tarjetas', 'credit-card', '#F97316'),
('Diversion', 'gasto', 'Estilo de Vida', 'ticket', '#A855F7');

-- SEED DATA: Prestamos Activos
INSERT INTO prestamos (deudor, monto_prestado, tasa_mensual, fecha_inicio, fecha_fin, cuotas_totales, estado, notas) VALUES
('Luz', 10000.00, 0.1000, '2025-04-15', NULL, 12, 'Pendiente', 'Rinde 500 mensual aprox.'),
('Jerson', 3500.00, 0.0000, NULL, NULL, 1, 'Pendiente', 'Pendiente de cobro'),
('Magaly 3', 2000.00, 0.1500, '2026-02-28', '2026-07-28', 5, 'Pendiente', 'Devuelve a fines de agosto'),
('Magaly 4', 2000.00, 0.1500, '2026-03-22', '2026-07-22', 4, 'Pendiente', 'Devuelve a fines de agosto'),
('Magaly 5', 500.00, 0.2000, '2026-05-08', '2026-07-25', 1, 'Pendiente', 'Paga los 25'),
('Magaly 6', 5000.00, 0.0600, '2026-07-06', '2026-09-25', 2, 'Pendiente', 'Paga adelantado los 25'),
('Frutero 2', 1000.00, 0.1500, '2026-05-28', '2026-09-28', 2, 'Pendiente', 'Pendiente');

