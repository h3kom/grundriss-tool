-- ============================================================
-- FIX: Infinite Recursion in RLS Policies
-- ============================================================
-- Problem: projects → project_members → projects (circular RLS)
-- Lösung: project_members SELECT darf NICHT projects referenzieren
-- 
-- Führe dieses Skript im Supabase SQL Editor aus.
-- ============================================================

-- 1. FIX: project_members SELECT – nur user_id prüfen (kein Cross-Reference)
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
CREATE POLICY "Members can view project members"
  ON public.project_members FOR SELECT
  USING (user_id = auth.uid());

-- 2. FIX: project_members INSERT – über projects.owner_id (safe, weil project_members SELECT jetzt nicht mehr projects referenziert)
DROP POLICY IF EXISTS "Owners can add members" ON public.project_members;
CREATE POLICY "Owners can add members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

-- 3. FIX: project_members DELETE
DROP POLICY IF EXISTS "Owners can remove members" ON public.project_members;
CREATE POLICY "Owners can remove members"
  ON public.project_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

-- 4. FIX: project_members UPDATE
DROP POLICY IF EXISTS "Owners can update member roles" ON public.project_members;
CREATE POLICY "Owners can update member roles"
  ON public.project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

-- 5. FIX: projects SELECT – owner ODER member (safe jetzt, da project_members SELECT nicht mehr referenziert)
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

-- 6. FIX: projects UPDATE
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

-- 7. FIX: floors – vereinfacht, nur über project_members (kein nested EXISTS)
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

-- 8. FIX: rooms – vereinfacht
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