-- =====================================================================
-- Fix: Projektmitglieder im Teilen-Modal sichtbar machen
-- =====================================================================
-- Problem: RLS auf project_members filtert so, dass User nur die
-- eigene Zeile sehen. Dadurch zeigt das Teilen-Modal nur "mich".
-- Loesung: Policy so anpassen, dass jedes Projektmitglied ALLE
-- Mitglieder desselben Projekts lesen darf.
--
-- Ausfuehren: Supabase Dashboard > SQL Editor > dieses Script paste + Run
-- =====================================================================

-- 1) Alte restriktive SELECT-Policies auf project_members entfernen
DROP POLICY IF EXISTS "Users can view own membership" ON project_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON project_members;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON project_members;
DROP POLICY IF EXISTS "Members can view all project members" ON project_members;

-- 2) Neue Policy: Jeder darf alle Eintraege von Projekten sehen,
--    in denen er selbst Mitglied ist
CREATE POLICY "Members can view all project members"
  ON project_members FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
    )
  );

-- 3) profiles: Authentifizierte User duerfen alle Profile lesen
--    (noetig fuer den Join profiles(display_name, email))
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON profiles;

CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
