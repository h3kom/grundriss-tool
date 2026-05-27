-- =====================================================================
-- KOMPLETT-FIX: Alle RLS-Policies auf project_members erneuern
-- =====================================================================
-- Bisherige Fixes waren unvollstaendig und haben nur SELECT behandelt.
-- DELETE und UPDATE hatten weiterhin rekursive Policies.
--
-- Dieses Script:
--   1. Listet alle existierenden Policies (zur Kontrolle)
--   2. Dropt ALLE Policies auf project_members
--   3. Erstellt SECURITY DEFINER Helper-Functions
--   4. Erstellt saubere, nicht-rekursive Policies fuer CRUD
--
-- Ausfuehren: Supabase Dashboard > SQL Editor > paste + Run
-- =====================================================================

-- =====================================================================
-- SCHRITT 1: Bestehende Policies anzeigen (nur Info, aendert nichts)
-- =====================================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'project_members';

-- =====================================================================
-- SCHRITT 2: ALLE existierenden Policies auf project_members entfernen
-- =====================================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'project_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON project_members', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END;
$$;

-- =====================================================================
-- SCHRITT 3: Helper-Functions (SECURITY DEFINER = kein RLS, keine Rekursion)
-- =====================================================================

-- Gibt alle project_ids zurueck, in denen der User Mitglied ist
CREATE OR REPLACE FUNCTION public.my_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT project_id FROM public.project_members
  WHERE user_id = auth.uid();
$$;

-- Prueft ob der User Owner eines bestimmten Projekts ist
CREATE OR REPLACE FUNCTION public.is_project_owner(proj_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = proj_id
    AND user_id = auth.uid()
    AND role = 'owner'
  );
$$;

-- =====================================================================
-- SCHRITT 4: Neue, nicht-rekursive Policies
-- =====================================================================

-- SELECT: Jedes Mitglied darf alle Mitglieder seiner Projekte sehen
CREATE POLICY "Members can view all project members"
  ON project_members FOR SELECT
  USING (
    project_id IN (SELECT public.my_project_ids())
  );

-- INSERT: Nur Owner duerfen Mitglieder hinzufuegen
CREATE POLICY "Only owners can add members"
  ON project_members FOR INSERT
  WITH CHECK (
    public.is_project_owner(project_id)
  );

-- UPDATE: Nur Owner duerfen Rollen aendern
CREATE POLICY "Only owners can update members"
  ON project_members FOR UPDATE
  USING (
    public.is_project_owner(project_id)
  )
  WITH CHECK (
    public.is_project_owner(project_id)
  );

-- DELETE: Nur Owner duerfen Mitglieder entfernen
CREATE POLICY "Only owners can delete members"
  ON project_members FOR DELETE
  USING (
    public.is_project_owner(project_id)
  );

-- =====================================================================
-- SCHRITT 5: Kontrolle — zeigt die neuen Policies
-- =====================================================================
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'project_members';
