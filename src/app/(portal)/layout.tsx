import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalSidebar } from "@/components/portal/portal-sidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Check user has 'client' role
  const admin = createAdminClient();
  if (!admin) {
    redirect("/portal/login");
  }

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

  // Get client name
  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", userRole.client_id)
    .single();

  const clientName = client?.name ?? "Client Portal";

  // Get enabled modules for this client
  const { data: enabledSettings } = await admin
    .from("client_portal_settings")
    .select("module")
    .eq("client_id", userRole.client_id)
    .eq("is_enabled", true);

  const enabledModules = (enabledSettings ?? []).map((s) => s.module);

  return (
    <div className="flex min-h-screen flex-col">
      <PortalHeader clientName={clientName} />
      <div className="flex flex-1">
        <PortalSidebar enabledModules={enabledModules} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
