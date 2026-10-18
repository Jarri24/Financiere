-- ========================================================
-- FINANCIERE APP - MIGRACION MULTI-USUARIO CON RLS
-- Seguridad absoluta: Aislamiento por auth.users
-- ========================================================

-- 1. Limpiar datos de prueba existentes
TRUNCATE TABLE transacciones CASCADE;
TRUNCATE TABLE pagos_prestamo CASCADE;
TRUNCATE TABLE presupuestos_mensuales CASCADE;
TRUNCATE TABLE prestamos CASCADE;
TRUNCATE TABLE categorias CASCADE;
TRUNCATE TABLE cuentas CASCADE;

-- 2. Agregar columna user_id en todas las tablas
ALTER TABLE cuentas 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE categorias 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE transacciones 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE prestamos 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE pagos_prestamo 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE presupuestos_mensuales 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- 3. Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_prestamo ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_mensuales ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS: Cada usuario solo accede y modifica sus propios registros
DROP POLICY IF EXISTS "Usuarios acceden solo a sus cuentas" ON cuentas;
CREATE POLICY "Usuarios acceden solo a sus cuentas" ON cuentas
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus categorias" ON categorias;
CREATE POLICY "Usuarios acceden solo a sus categorias" ON categorias
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus transacciones" ON transacciones;
CREATE POLICY "Usuarios acceden solo a sus transacciones" ON transacciones
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus prestamos" ON prestamos;
CREATE POLICY "Usuarios acceden solo a sus prestamos" ON prestamos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus pagos_prestamo" ON pagos_prestamo;
CREATE POLICY "Usuarios acceden solo a sus pagos_prestamo" ON pagos_prestamo
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios acceden solo a sus presupuestos" ON presupuestos_mensuales;
CREATE POLICY "Usuarios acceden solo a sus presupuestos" ON presupuestos_mensuales
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. TRIGGER AUTOMATICO: Sembrar categorías estándar a cada nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $$
BEGIN
    -- Categorías estándar universales de Ingreso
    INSERT INTO public.categorias (nombre, tipo, grupo, icono, color, user_id) VALUES
    ('Salario / Sueldo', 'ingreso', 'Laboral', 'briefcase', '#10B981', NEW.id),
    ('Inversión & Rendimientos', 'ingreso', 'Rendimientos', 'piggy-bank', '#6366F1', NEW.id),
    ('Intereses de Préstamos', 'ingreso', 'Rendimientos', 'trending-up', '#3B82F6', NEW.id),
    ('Otros Ingresos', 'ingreso', 'Otros', 'plus-circle', '#8B5CF6', NEW.id);

    -- Categorías estándar universales de Gasto
    INSERT INTO public.categorias (nombre, tipo, grupo, icono, color, es_fijo, user_id) VALUES
    ('Alimentación & Supermercado', 'gasto', 'Alimentacion', 'cake', '#EF4444', false, NEW.id),
    ('Transporte & Movilidad', 'gasto', 'Transporte', 'truck', '#64748B', false, NEW.id),
    ('Servicios & Hogar (Luz, Agua, Net)', 'gasto', 'Servicios', 'light-bulb', '#0284C7', true, NEW.id),
    ('Entretenimiento & Ocio', 'gasto', 'Estilo de Vida', 'ticket', '#A855F7', false, NEW.id),
    ('Suscripciones & Apps', 'gasto', 'Suscripciones', 'sparkles', '#8B5CF6', true, NEW.id),
    ('Salud & Cuidado Personal', 'gasto', 'Salud', 'heart', '#EC4899', false, NEW.id),
    ('Compras & Ropa', 'gasto', 'Compras', 'shopping-bag', '#F59E0B', false, NEW.id),
    ('Educación & Cursos', 'gasto', 'Educacion', 'academic-cap', '#3B82F6', false, NEW.id),
    ('Pagos de Tarjetas / Deudas', 'gasto', 'Tarjetas', 'credit-card', '#EA580C', false, NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

