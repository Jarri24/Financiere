-- ========================================================
-- FINANCIERE APP - MÓDULO INTEGRAL COMPLETO (RLS & MULTI-TENANT)
-- 1. Configuración de Usuario
-- 2. Gastos Recurrentes & Suscripciones Fijas
-- 3. Presupuestos Mensuales por Categoría
-- ========================================================

-- TABLA 1: CONFIGURACION DE USUARIO
CREATE TABLE IF NOT EXISTS public.configuracion_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL DEFAULT auth.uid(),
    nombre TEXT DEFAULT 'Usuario',
    tipo_cambio NUMERIC(8,4) DEFAULT 3.7500,
    email_reportes TEXT,
    recibir_reporte_email BOOLEAN DEFAULT false,
    telefono TEXT,
    telegram_id TEXT,
    recibir_reporte_telegram BOOLEAN DEFAULT false,
    hora_reporte TIME DEFAULT '07:30:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.configuracion_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios acceden a su propia configuracion" ON public.configuracion_usuario;
CREATE POLICY "Usuarios acceden a su propia configuracion" ON public.configuracion_usuario
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- TABLA 2: GASTOS RECURRENTES Y SUSCRIPCIONES
CREATE TABLE IF NOT EXISTS public.gastos_recurrentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    nombre TEXT NOT NULL,
    monto NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    moneda VARCHAR(3) DEFAULT 'PEN',
    dia_pago INTEGER CHECK (dia_pago >= 1 AND dia_pago <= 31),
    frecuencia VARCHAR(20) DEFAULT 'mensual', -- mensual, anual, quincenal
    cuenta_id UUID REFERENCES public.cuentas(id) ON DELETE SET NULL,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    icono TEXT DEFAULT 'calendar',
    activo BOOLEAN DEFAULT true,
    ultimo_pago_fecha DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.gastos_recurrentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios acceden a sus propios gastos recurrentes" ON public.gastos_recurrentes;
CREATE POLICY "Usuarios acceden a sus propios gastos recurrentes" ON public.gastos_recurrentes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- TABLA 3: PRESUPUESTOS MENSUALES POR CATEGORIA
CREATE TABLE IF NOT EXISTS public.presupuestos_mensuales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE NOT NULL,
    monto_limite NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    mes_anio VARCHAR(7), -- Formato 'YYYY-MM' o NULL para presupuesto base mensual
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, categoria_id)
);

ALTER TABLE public.presupuestos_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios acceden a sus propios presupuestos" ON public.presupuestos_mensuales;
CREATE POLICY "Usuarios acceden a sus propios presupuestos" ON public.presupuestos_mensuales
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
