import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreviewClientId } from "@/lib/actions/portal-data";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalPreviewBanner } from "@/components/portal/portal-preview-banner";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isPreview = cookieStore.get("portal_preview")?.value === "true";

  const supabase = await createClient();
  if (!supabase) {
    redirect("/portal/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  const admin = createAdminClient();
  if (!admin) {
    redirect("/portal/login");
  }

  let clientId: string | null = null;
  let clientName = "Client Portal";

  if (isPreview) {
    // Consultant preview mode — use active client
    clientId = await getPreviewClientId();
    if (!clientId) {
      redirect("/portal/login?error=auth_failed");
    }
  } else {
    // Normal client auth — require client role
    const { data: userRole } = await admin
      .from("user_roles")
      .select("client_id, role")
      .eq("user_id", user.id)
      .eq("role", "client")
      .limit(1)
      .single();

    if (!userRole) {
      redirect("/portal/login?error=auth_failed");
    }
    clientId = userRole.client_id;
  }

  // Get client name
  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();

  clientName = client?.name ?? "Client Portal";

  // Get enabled modules for this client
  const { data: enabledSettings } = await admin
    .from("client_portal_settings")
    .select("module")
    .eq("client_id", clientId)
    .eq("is_enabled", true);

  const enabledModules = (enabledSettings ?? []).map((s) => s.module);

  return (
    <div className="flex min-h-screen flex-col">
      {isPreview && <PortalPreviewBanner />}
      <PortalHeader clientName={clientName} isPreview={isPreview} />
      <div className="flex flex-1">
        <PortalSidebar enabledModules={enabledModules} isPreview={isPreview} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
