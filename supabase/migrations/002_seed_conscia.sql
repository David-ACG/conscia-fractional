-- Seed data: Conscia engagement
-- Run after 001_initial_schema.sql

-- Conscia client
INSERT INTO public.clients (name, slug, website, industry, description) VALUES
('Conscia', 'conscia', 'https://conscia.ai', 'Digital Experience Orchestration (DXO)',
 'Conscia.ai is a Digital Experience Orchestration platform — the middle orchestration layer connecting frontends to backends in composable/headless architecture. Zero-code API orchestration, sub-100ms response times, Experience APIs with MCP support. ~27 employees, Toronto HQ, staff across 3 continents.');

-- Engagement
INSERT INTO public.engagements (client_id, role_title, start_date, hours_per_week, day_rate_gbp, hourly_rate_gbp, billing_frequency, payment_terms, scope, status) VALUES
((SELECT id FROM public.clients WHERE slug = 'conscia'),
 'Solution Architect',
 '2026-03-23',
 16,
 500.00,
 62.50,
 'monthly',
 'Net 10 days after Conscia receives client payment',
 '["Customer representation for POC projects", "Solution delivery — architect, develop, implement solutions", "Platform familiarity — Conscia Orchestration platform"]',
 'active');

-- CRM customers
INSERT INTO public.crm_customers (client_id, name, slug, industry, status) VALUES
((SELECT id FROM public.clients WHERE slug = 'conscia'), 'Staples', 'staples', 'Retail / Office Supplies', 'active'),
((SELECT id FROM public.clients WHERE slug = 'conscia'), 'Jaguar Land Rover', 'jlr', 'Automotive', 'active'),
((SELECT id FROM public.clients WHERE slug = 'conscia'), 'Holt Renfrew', 'holt-renfrew', 'Luxury Retail', 'active'),
((SELECT id FROM public.clients WHERE slug = 'conscia'), 'LoveSac', 'lovesac', 'Furniture / DTC', 'active');

-- Contacts
INSERT INTO public.contacts (client_id, name, role, linkedin_url, preferred_contact_method, skills, notes) VALUES
((SELECT id FROM public.clients WHERE slug = 'conscia'),
 'Sana Remekie',
 'CEO & Co-founder',
 'https://www.linkedin.com/in/sana-remekie/',
 'slack',
 '["DXO", "Composable Architecture", "MACH", "Enterprise Sales", "System Design Engineering"]',
 '15+ years in data-centric ecommerce solutions. MACH Ambassador. Canada''s Top 10 Influential Women in Tech.'),
((SELECT id FROM public.clients WHERE slug = 'conscia'),
 'Morgan Johanson',
 'Partnerships and Customer Success Lead',
 'https://www.linkedin.com/in/morgan-johanson/',
 'slack',
 '["Customer Success", "Partnerships", "Digital Marketing"]',
 'Based in Ontario, Canada. Background in digital marketing, previously at Orium.');
