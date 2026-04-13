import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegrations } from "@/lib/services/integration-service";
import type { DecryptedIntegration } from "@/lib/services/integration-service";
import { getActiveClientId } from "@/lib/actions/clients";
import { getPortalSettings, getPortalInvitations } from "@/lib/actions/portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisconnectButton } from "./disconnect-button";
import { GoogleIntegrationsSection } from "./google-integrations";
import { SlackChannelMapper } from "@/components/settings/slack-channel-mapper";
import { SlackNotificationToggles } from "@/components/settings/slack-notification-toggles";
import { SlackReactionEmoji } from "@/components/settings/slack-reaction-emoji";
import { PortalSharingSettings } from "@/components/settings/portal-sharing-settings";

const OTHER_PROVIDERS = [
  {
    id: "slack",
    name: "Slack",
    description: "Messaging and notifications",
    connectUrl: "/api/auth/slack",
  },
  { id: "deepgram", name: "Deepgram", description: "Meeting transcription" },
];

async function getSettingsData() {
  const supabase = await createClient();
  if (!supabase)
    return {
      integrations: [],
      crmCustomers: [],
      clientId: null,
      portalSettings: [],
      portalInvitations: [],
    };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      integrations: [],
      crmCustomers: [],
      clientId: null,
      portalSettings: [],
      portalInvitations: [],
    };

  try {
    const clientId = await getActiveClientId();
    const integrations = await getIntegrations(user.id);

    const admin = createAdminClient();
    let crmCustomers: { id: string; name: string }[] = [];
    if (admin) {
      const { data } = await admin
        .from("crm_customers")
        .select("id, name")
        .order("name", { ascending: true });
      crmCustomers = data ?? [];
    }

    // Fetch portal data if we have an active client
    let portalSettings: Awaited<ReturnType<typeof getPortalSettings>>["data"] =
      [];
    let portalInvitations: Awaited<
      ReturnType<typeof getPortalInvitations>
    >["data"] = [];
    if (clientId) {
      const [settingsResult, invitationsResult] = await Promise.all([
        getPortalSettings(clientId),
        getPortalInvitations(clientId),
      ]);
      portalSettings = settingsResult.data ?? [];
      portalInvitations = invitationsResult.data ?? [];
    }

    return {
      integrations,
      crmCustomers,
      clientId,
      portalSettings,
      portalInvitations,
    };
  } catch {
    return {
      integrations: [],
      crmCustomers: [],
      clientId: null,
      portalSettings: [],
      portalInvitations: [],
    };
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    google?: string;
    email?: string;
    error?: string;
    slack?: string;
    message?: string;
  }>;
}) {
  const {
    integrations,
    crmCustomers,
    clientId,
    portalSettings,
    portalInvitations,
  } = await getSettingsData();
  const params = await searchParams;

  const googleIntegrations = integrations.filter(
    (i) => i.provider === "google",
  );

  const otherIntegrationMap = new Map<string, DecryptedIntegration>();
  for (const integration of integrations) {
    if (integration.provider !== "google") {
      otherIntegrationMap.set(integration.provider, integration);
    }
  }

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your integrations and preferences.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Google — supports multiple accounts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Google</CardTitle>
            <Badge
              variant={googleIntegrations.length > 0 ? "default" : "secondary"}
              className={
                googleIntegrations.length > 0
                  ? "bg-green-600 hover:bg-green-600"
                  : ""
              }
            >
              {googleIntegrations.length > 0 ? "Connected" : "Not Connected"}
            </Badge>
          </CardHeader>
          <CardContent>
            <GoogleIntegrationsSection
              integrations={googleIntegrations}
              successEmail={
                params.google === "connected" ? params.email : undefined
              }
              errorCode={params.error}
            />
          </CardContent>
        </Card>

        {/* Other providers */}
        {OTHER_PROVIDERS.map((provider) => {
          const integration = otherIntegrationMap.get(provider.id);
          const isConnected = !!integration;
          const showSuccess =
            provider.id === "slack" && params.slack === "connected";
          const showError = provider.id === "slack" && params.slack === "error";

          return (
            <Card key={provider.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">
                  {provider.name}
                </CardTitle>
                <Badge
                  variant={isConnected ? "default" : "secondary"}
                  className={
                    isConnected ? "bg-green-600 hover:bg-green-600" : ""
                  }
                >
                  {isConnected ? "Connected" : "Not Connected"}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {provider.description}
                </p>
                {isConnected && integration.account_identifier && (
                  <p className="mt-2 text-sm font-medium">
                    {integration.account_identifier}
                  </p>
                )}
                {isConnected && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connected{" "}
                    {new Date(integration.created_at).toLocaleDateString()}
                  </p>
                )}
                {showSuccess && (
                  <p className="mt-2 text-xs text-green-600">
                    Workspace connected successfully.
                  </p>
                )}
                {showError && (
                  <p className="mt-2 text-xs text-destructive">
                    Connection failed
                    {params.message ? `: ${params.message}` : ""}. Try again.
                  </p>
                )}
                {provider.id === "slack" && isConnected && integration && (
                  <>
                    <SlackChannelMapper
                      integrationId={integration.id}
                      customers={crmCustomers}
                    />
                    <SlackNotificationToggles
                      integrationId={integration.id}
                      notifyMeetingSummaries={
                        integration.metadata?.notify_meeting_summaries !== false
                      }
                      notifyTaskUpdates={
                        integration.metadata?.notify_task_updates !== false
                      }
                    />
                    <SlackReactionEmoji
                      integrationId={integration.id}
                      taskReactionEmoji={
                        (integration.metadata?.task_reaction_emoji as
                          | string
                          | undefined) ?? "white_check_mark"
                      }
                    />
                  </>
                )}
                <div className="mt-4">
                  {isConnected ? (
                    <DisconnectButton integrationId={integration.id} />
                  ) : "connectUrl" in provider && provider.connectUrl ? (
                    <a
                      href={provider.connectUrl}
                      className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Connect {provider.name}
                    </a>
                  ) : (
                    <button
                      disabled
                      className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground opacity-50 cursor-not-allowed"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Portal Sharing */}
      {clientId && (
        <div id="portal" className="mt-10 scroll-mt-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Portal Sharing
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Control what clients can see and who has access to the portal.
          </p>
          <PortalSharingSettings
            clientId={clientId}
            settings={portalSettings ?? []}
            invitations={portalInvitations ?? []}
          />
        </div>
      )}
    </div>
  );
}
