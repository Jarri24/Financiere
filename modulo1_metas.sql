-- ========================================================
-- FINANCIERE APP - MODULO 1: METAS DE AHORRO Y PROYECTOS
-- ========================================================

CREATE TABLE IF NOT EXISTS metas_ahorro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    nombre VARCHAR(150) NOT NULL,
    monto_objetivo NUMERIC(12, 2) NOT NULL,
    monto_actual NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
    fecha_limite DATE,
    icono VARCHAR(50) DEFAULT 'target',
    color VARCHAR(20) DEFAULT '#10B981',
    notas TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'En progreso' CHECK (estado IN ('En progreso', 'Completado', 'Pausado')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS estricto
ALTER TABLE metas_ahorro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Privacidad Metas" ON metas_ahorro;
CREATE POLICY "Privacidad Metas" ON metas_ahorro FOR ALL 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
