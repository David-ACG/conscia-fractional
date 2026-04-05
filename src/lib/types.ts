// Database types — matches supabase/migrations/001_initial_schema.sql

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "consultant" | "client";
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  logo_url: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Engagement {
  id: string;
  client_id: string;
  role_title: string;
  start_date: string | null;
  end_date: string | null;
  hours_per_week: number;
  day_rate_gbp: number | null;
  hourly_rate_gbp: number | null;
  billing_frequency: string | null;
  payment_terms: string | null;
  scope: string[];
  out_of_scope: string[];
  contract_data: Record<string, unknown>;
  status: "active" | "paused" | "completed";
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  slack_id: string | null;
  linkedin_url: string | null;
  preferred_contact_method: "slack" | "email" | "phone" | "teams";
  skills: string[];
  working_on: string | null;
  notes: string | null;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmCustomer {
  id: string;
  client_id: string;
  name: string;
  slug: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  status: "prospect" | "active" | "completed" | "lost";
  primary_contact: string | null;
  google_drive_url: string | null;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  client_id: string;
  crm_customer_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assignee: string | null;
  assignee_type: "self" | "client_team" | "external";
  due_date: string | null;
  meeting_id: string | null;
  confidence: "explicit" | "inferred" | "tentative" | null;
  source_quote: string | null;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

export interface MeetingAttendee {
  name: string;
  email?: string;
  role?: string;
}

export interface Meeting {
  id: string;
  client_id: string;
  crm_customer_id: string | null;
  title: string;
  meeting_date: string | null;
  duration_minutes: number | null;
  attendees: MeetingAttendee[];
  transcript: string | null;
  summary: string | null;
  action_items: string[];
  recording_url: string | null;
  platform: "zoom" | "teams" | "meet" | null;
  original_filename: string | null;
  actual_duration_seconds: number | null;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  client_id: string;
  crm_customer_id: string | null;
  category: string;
  description: string | null;
  started_at: string;
  stopped_at: string | null;
  duration_minutes: number | null;
  is_manual: boolean;
  meeting_id: string | null;
  is_billable: boolean;
  freeagent_timeslip_id: string | null;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActiveTimer {
  id: string;
  user_id: string;
  client_id: string | null;
  category: string | null;
  started_at: string;
  created_at: string;
}

export interface Note {
  id: string;
  client_id: string;
  title: string;
  content: string | null;
  note_type: "note" | "decision" | "context";
  tags: string[];
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Research {
  id: string;
  client_id: string;
  title: string;
  content: string | null;
  research_type:
    | "architecture"
    | "competitor"
    | "technology"
    | "market"
    | "other";
  tags: string[];
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  client_id: string;
  crm_customer_id: string | null;
  name: string;
  description: string | null;
  asset_type: "template" | "diagram" | "document" | "other";
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  client_id: string;
  crm_customer_id: string | null;
  name: string;
  description: string | null;
  status: "draft" | "in_progress" | "review" | "delivered";
  due_date: string | null;
  file_url: string | null;
  file_name: string | null;
  version: number;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface EngagementQuestionnaire {
  id: string;
  engagement_id: string;
  client_id: string;
  status: "draft" | "sent" | "partial" | "completed" | "reviewed";
  contract_data: Record<string, unknown>;
  questions: unknown[];
  answers: Record<string, unknown>;
  sent_to_email: string | null;
  sent_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ScopeCreepEntry {
  id: string;
  engagement_id: string;
  client_id: string;
  description: string;
  requested_by: string | null;
  requested_date: string;
  status: "logged" | "discussed" | "accepted" | "declined";
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  freeagent_invoice_id: string | null;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  total_hours: number | null;
  total_amount_gbp: number | null;
  status: "draft" | "sent" | "viewed" | "overdue" | "paid";
  paid_on: string | null;
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliverableVersion {
  id: string;
  deliverable_id: string;
  version: number;
  notes: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: string | null;
  client_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: "consultant" | "client";
  client_id: string | null;
}

export interface MeetingPreFillParticipant {
  contact_id?: string;
  email: string;
  name: string;
}

export interface MeetingPreFillData {
  title: string;
  date: string; // ISO string (start_time of calendar event)
  duration: number; // minutes, rounded up to nearest 15
  crm_customer_id: string | null;
  participants: MeetingPreFillParticipant[];
  meeting_url: string | null;
  source_event_id: string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider: string;
  account_identifier: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalSettings {
  id: string;
  client_id: string;
  module: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalInvitation {
  id: string;
  client_id: string;
  email: string;
  invited_by: string;
  auth_user_id: string | null;
  status: "pending" | "accepted" | "revoked";
  invited_at: string;
  accepted_at: string | null;
  last_login: string | null;
}

export const PORTAL_MODULES = [
  "timesheet",
  "tasks",
  "meetings",
  "deliverables",
  "invoicing",
  "notes",
  "research",
] as const;

export type PortalModule = (typeof PORTAL_MODULES)[number];
