-- =====================================================================
-- NOTFALL-FIX: RLS-Endlosschleife aufheben
-- =====================================================================
-- Das vorherige Script hat eine rekursive Policy erstellt, die alle
-- Queries mit 500 crashen laesst. Dieses Script:
--   1. Dropt die rekursive Policy
--   2. Erstellt eine SECURITY DEFINER Function (ohne RLS)
--   3. Erstellt eine neue Policy, die die Function nutzt (nicht-rekursiv)
--
-- Ausfuehren: Supabase Dashboard > SQL Editor > paste + Run
-- =====================================================================

-- 1) Die rekursive Policy sofort entfernen
DROP POLICY IF EXISTS "Members can view all project members" ON project_members;

-- 2) SECURITY DEFINER Function im public-Schema (auth ist gesperrt)
CREATE OR REPLACE FUNCTION public.my_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT project_id FROM public.project_members
  WHERE user_id = auth.uid();
$$;

-- 3) Neue Policy mit der Function (keine Selbstreferenz mehr)
CREATE POLICY "Members can view all project members"
  ON project_members FOR SELECT
  USING (
    project_id IN (SELECT public.my_project_ids())
  );
