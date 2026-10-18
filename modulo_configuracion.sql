-- ========================================================
-- FINANCIERE APP - TABLA CONFIGURACION DE USUARIO
-- ========================================================

CREATE TABLE IF NOT EXISTS configuracion_usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(100),
    email_reportes VARCHAR(150),
    telefono VARCHAR(30),
    telegram_id VARCHAR(50),
    tipo_cambio NUMERIC(8, 4) DEFAULT 3.7500,
    recibir_reporte_email BOOLEAN DEFAULT false,
    recibir_reporte_telegram BOOLEAN DEFAULT false,
    hora_reporte TIME DEFAULT '07:30:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE configuracion_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Privacidad Configuracion" ON configuracion_usuario;
CREATE POLICY "Privacidad Configuracion" ON configuracion_usuario FOR ALL 
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
