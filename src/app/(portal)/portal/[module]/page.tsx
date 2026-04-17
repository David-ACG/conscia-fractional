import { redirect, notFound } from "next/navigation";
import { getPortalClientId } from "@/lib/actions/portal-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalTimesheet } from "@/components/portal/portal-timesheet";
import { PortalMeetings } from "@/components/portal/portal-meetings";
import { PortalDeliverables } from "@/components/portal/portal-deliverables";
import { PortalInvoicing } from "@/components/portal/portal-invoicing";
import { PortalNotes } from "@/components/portal/portal-notes";
import { PortalResearch } from "@/components/portal/portal-research";
import { PortalCustomers } from "@/components/portal/portal-customers";

export default async function PortalModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const clientId = await getPortalClientId();
  if (!clientId) redirect("/portal/login");

  const admin = createAdminClient();
  if (!admin) redirect("/portal/login");

  const { data: setting } = await admin
    .from("client_portal_settings")
    .select("is_enabled")
    .eq("client_id", clientId)
    .eq("module", module)
    .single();

  if (!setting?.is_enabled) notFound();

  switch (module) {
    case "timesheet":
      return <PortalTimesheet clientId={clientId} />;
    case "meetings":
      return <PortalMeetings clientId={clientId} />;
    case "deliverables":
      return <PortalDeliverables clientId={clientId} />;
    case "invoicing":
      return <PortalInvoicing clientId={clientId} />;
    case "notes":
      return <PortalNotes clientId={clientId} />;
    case "research":
      return <PortalResearch clientId={clientId} />;
    case "customers":
      return <PortalCustomers clientId={clientId} />;
    default:
      notFound();
  }
}
