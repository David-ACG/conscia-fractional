-- Add crm_customer_id to assets table for customer-level filtering
ALTER TABLE public.assets
  ADD COLUMN crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL;
