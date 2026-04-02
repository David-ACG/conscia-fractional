"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { removeGoogleIntegration } from "@/lib/actions/integrations";
import type { DecryptedIntegration } from "@/lib/services/integration-service";

interface GoogleIntegrationsSectionProps {
  integrations: DecryptedIntegration[];
  successEmail?: string;
  errorCode?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Google sign-in was incomplete. Please try again.",
  invalid_state: "Security check failed. Please try connecting again.",
  exchange_failed: "Could not complete sign-in with Google. Please try again.",
  no_refresh_token:
    "Google did not return a refresh token. Please revoke access in your Google Account settings and reconnect.",
  unknown: "An unexpected error occurred. Please try again.",
};

const SCOPE_LABELS: Record<string, string> = {
  "https://www.googleapis.com/auth/drive.readonly": "Drive",
  "https://www.googleapis.com/auth/calendar.readonly": "Calendar",
  "https://www.googleapis.com/auth/gmail.metadata": "Gmail",
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Connected today";
  if (diffDays === 1) return "Connected yesterday";
  if (diffDays < 30) return `Connected ${diffDays} days ago`;
  if (diffDays < 365)
    return `Connected ${Math.floor(diffDays / 30)} months ago`;
  return `Connected ${Math.floor(diffDays / 365)} years ago`;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function DisconnectConfirmDialog({
  integrationId,
  email,
  onDisconnected,
}: {
  integrationId: string;
  email: string;
  onDisconnected: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      const result = await removeGoogleIntegration(integrationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Disconnected ${email}`);
        onDisconnected();
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          {isPending ? "Disconnecting..." : "Disconnect"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Google account?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove <strong>{email}</strong> from FractionalBuddy. You
            can reconnect at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisconnect}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function GoogleIntegrationsSection({
  integrations,
  successEmail,
  errorCode,
}: GoogleIntegrationsSectionProps) {
  const router = useRouter();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    if (successEmail) {
      toast.success(`Google account ${successEmail} connected`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true);
      router.replace("/dashboard/settings");
    } else if (errorCode) {
      toast.error(ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.unknown);
      setShown(true);
      router.replace("/dashboard/settings");
    }
  }, [successEmail, errorCode, shown, router]);

  if (integrations.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GoogleIcon />
          <span>
            Connect your Google account to access Drive, Calendar, and Gmail
          </span>
        </div>
        <Button asChild size="sm" className="w-fit">
          <a href="/api/auth/google?scopes=drive.readonly">Connect Google</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {integrations.map((integration) => (
        <div
          key={integration.id}
          className="rounded-md border p-3 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GoogleIcon />
              <span className="text-sm font-medium">
                {integration.account_identifier}
              </span>
            </div>
            <DisconnectConfirmDialog
              integrationId={integration.id}
              email={integration.account_identifier ?? "this account"}
              onDisconnected={() => router.refresh()}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {formatRelativeDate(integration.created_at)}
          </p>

          <div className="flex flex-wrap gap-1">
            {integration.scopes.map((scope) => {
              const label = SCOPE_LABELS[scope];
              return label ? (
                <Badge key={scope} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ) : null;
            })}
          </div>

          <div className="flex gap-2 mt-1 flex-wrap">
            {integration.scopes.includes(
              "https://www.googleapis.com/auth/calendar.readonly",
            ) ? null : (
              <Button asChild size="sm" variant="outline" className="text-xs">
                <a href="/api/auth/google?scopes=calendar.readonly">
                  Add Calendar Access
                </a>
              </Button>
            )}

            {integration.scopes.includes(
              "https://www.googleapis.com/auth/gmail.metadata",
            ) ? null : (
              <Button asChild size="sm" variant="outline" className="text-xs">
                <a href="/api/auth/google?scopes=gmail.metadata">
                  Add Gmail Access
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}

      <Button asChild size="sm" variant="outline" className="w-fit">
        <a href="/api/auth/google?scopes=drive.readonly">
          + Connect Another Account
        </a>
      </Button>
    </div>
  );
}
