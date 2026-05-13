-- ============================================================
-- Grundriss Tool – Supabase Multi-User Schema
-- ============================================================
-- Führe dieses Skript im Supabase SQL Editor aus.
-- Es erstellt alle benötigten Tabellen, Storage und RLS-Policies.
--
-- WICHTIG: Wenn du bereits eine `rooms`-Tabelle hast, wird diese
-- um die Spalte `project_id` erweitert (siehe Abschnitt 5).
-- ============================================================

-- 1. PROFILES (automatisch nach Auth-Registrierung)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Automatisches Profile-Erstellung nach Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Unbenanntes Projekt',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_project_update ON public.projects;
CREATE TRIGGER on_project_update
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. PROJECT_MEMBERS (Kollaboration)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 4. FLOORS (Stockwerke pro Projekt)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Stockwerk',
  image_url TEXT,
  native_width INTEGER DEFAULT 1000,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ROOMS (Raumdaten – erweitert bestehende Tabelle)
-- ============================================================
-- Falls die Tabelle noch nicht existiert, wird sie erstellt.
-- Falls sie existiert, wird sie um `project_id` und `data` erweitert.

DO $$
BEGIN
  -- Prüfe ob rooms-Tabelle existiert
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rooms'
  ) THEN
    -- Tabelle existiert nicht → komplett erstellen
    CREATE TABLE public.rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  ELSE
    -- Tabelle existiert → fehlende Spalten hinzufügen

    -- project_id hinzufügen falls nicht vorhanden
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'project_id'
    ) THEN
      ALTER TABLE public.rooms ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;

    -- data (JSONB) hinzufügen falls nicht vorhanden
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'data'
    ) THEN
      ALTER TABLE public.rooms ADD COLUMN data JSONB NOT NULL DEFAULT '{}';
    END IF;

    -- updated_at hinzufügen falls nicht vorhanden
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.rooms ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;

    -- id als UUID hinzufügen falls nicht vorhanden (falls alte Tabelle anderen PK hat)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'id'
    ) THEN
      ALTER TABLE public.rooms ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
    END IF;
  END IF;
END $$;

-- 6. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('floor-plans', 'floor-plans', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (idempotent – DROP IF EXISTS zuerst)
DROP POLICY IF EXISTS "Anyone can view floor plans" ON storage.objects;
CREATE POLICY "Anyone can view floor plans"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'floor-plans');

DROP POLICY IF EXISTS "Authenticated users can upload floor plans" ON storage.objects;
CREATE POLICY "Authenticated users can upload floor plans"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'floor-plans' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own floor plans" ON storage.objects;
CREATE POLICY "Users can delete own floor plans"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'floor-plans' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own floor plans" ON storage.objects;
CREATE POLICY "Users can update own floor plans"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'floor-plans' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Profiles: User können eigenes Profil sehen/aktualisieren
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Projects: Owner und Members können sehen
DROP POLICY IF EXISTS "Users can view their projects" ON public.projects;
CREATE POLICY "Users can view their projects"
  ON public.projects FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update projects" ON public.projects;
CREATE POLICY "Owners can update projects"
  ON public.projects FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Owners can delete projects" ON public.projects;
CREATE POLICY "Owners can delete projects"
  ON public.projects FOR DELETE
  USING (owner_id = auth.uid());

-- Project Members: KEIN Cross-Reference zu projects (vermeidet infinite recursion!)
-- WICHTIG: project_members SELECT darf NICHT projects referenzieren!
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
CREATE POLICY "Members can view project members"
  ON public.project_members FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can add members" ON public.project_members;
CREATE POLICY "Owners can add members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can remove members" ON public.project_members;
CREATE POLICY "Owners can remove members"
  ON public.project_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update member roles" ON public.project_members;
CREATE POLICY "Owners can update member roles"
  ON public.project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

-- Floors: Projekt-Mitglieder können sehen (kein nested EXISTS!)
DROP POLICY IF EXISTS "Members can view floors" ON public.floors;
CREATE POLICY "Members can view floors"
  ON public.floors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Editors can insert floors" ON public.floors;
CREATE POLICY "Editors can insert floors"
  ON public.floors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Editors can update floors" ON public.floors;
CREATE POLICY "Editors can update floors"
  ON public.floors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Owners can delete floors" ON public.floors;
CREATE POLICY "Owners can delete floors"
  ON public.floors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

-- Rooms: Projekt-Mitglieder können sehen/bearbeiten (kein nested EXISTS!)
DROP POLICY IF EXISTS "Members can view rooms" ON public.rooms;
CREATE POLICY "Members can view rooms"
  ON public.rooms FOR SELECT
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Editors can insert rooms" ON public.rooms;
CREATE POLICY "Editors can insert rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Editors can update rooms" ON public.rooms;
CREATE POLICY "Editors can update rooms"
  ON public.rooms FOR UPDATE
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'editor')
    )
  );

-- 8. INDIZES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_floors_project ON public.floors(project_id);
CREATE INDEX IF NOT EXISTS idx_rooms_project ON public.rooms(project_id);