CREATE TABLE public.deliverable_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  version integer NOT NULL,
  notes text,
  file_url text,
  file_name text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.deliverable_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultant full access to deliverable_versions"
  ON public.deliverable_versions FOR ALL
  USING (public.is_consultant())
  WITH CHECK (public.is_consultant());

CREATE POLICY "Client read own deliverable_versions"
  ON public.deliverable_versions FOR SELECT
  USING (
    public.get_app_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
      AND d.client_id = public.get_client_id()
      AND d.is_client_visible = true
    )
  );

CREATE INDEX idx_deliverable_versions_deliverable ON public.deliverable_versions(deliverable_id);
