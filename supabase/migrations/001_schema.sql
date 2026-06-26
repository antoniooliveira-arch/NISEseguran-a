-- NISE Database Schema
-- Run this SQL in the Supabase SQL Editor

-- Drop tables if re-running
DROP TABLE IF EXISTS public.encaminhamentos;
DROP TABLE IF EXISTS public.rondas;
DROP TABLE IF EXISTS public.nise_users;

-- ==========================================
-- NISE Users (separate from auth.users)
-- ==========================================
CREATE TABLE public.nise_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tecnico')),
  password TEXT NOT NULL DEFAULT '123',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- Rondas
-- ==========================================
CREATE TABLE public.rondas (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  tecnico_id TEXT NOT NULL REFERENCES public.nise_users(id),
  tecnico_name TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  categories JSONB NOT NULL DEFAULT '[]',
  audio_blob_url TEXT,
  audio_description TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'registrada' CHECK (status IN ('registrada', 'encaminhada', 'concluida')),
  prioridade TEXT NOT NULL DEFAULT 'Baixa' CHECK (prioridade IN ('Baixa', 'Média', 'Alta', 'Crítica')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- Encaminhamentos
-- ==========================================
CREATE TABLE public.encaminhamentos (
  id TEXT PRIMARY KEY,
  ronda_id TEXT NOT NULL REFERENCES public.rondas(id),
  school_name TEXT NOT NULL,
  titulo TEXT NOT NULL,
  categorias JSONB NOT NULL DEFAULT '[]',
  date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em Andamento', 'Concluído')),
  notas JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_rondas_school_id ON public.rondas(school_id);
CREATE INDEX IF NOT EXISTS idx_rondas_tecnico_id ON public.rondas(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_rondas_date ON public.rondas(date DESC);
CREATE INDEX IF NOT EXISTS idx_encaminhamentos_ronda_id ON public.encaminhamentos(ronda_id);
CREATE INDEX IF NOT EXISTS idx_encaminhamentos_status ON public.encaminhamentos(status);

-- ==========================================
-- Seed data: initial users
-- ==========================================
INSERT INTO public.nise_users (id, name, email, role, password, active) VALUES
  ('u1', 'Pedro', 'admin', 'admin', 'Admin123', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- Permissions
-- ==========================================
ALTER TABLE public.nise_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rondas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.encaminhamentos DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.nise_users TO anon, authenticated;
GRANT ALL ON public.rondas TO anon, authenticated;
GRANT ALL ON public.encaminhamentos TO anon, authenticated;

-- ==========================================
-- Storage bucket for audio files
-- ==========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('nise-audio', 'nise-audio', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to audio files
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public Access') THEN
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'nise-audio');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Upload Access') THEN
    CREATE POLICY "Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'nise-audio');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Update Access') THEN
    CREATE POLICY "Update Access" ON storage.objects FOR UPDATE USING (bucket_id = 'nise-audio');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Delete Access') THEN
    CREATE POLICY "Delete Access" ON storage.objects FOR DELETE USING (bucket_id = 'nise-audio');
  END IF;
END $$;
