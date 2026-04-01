"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { disconnectIntegration } from "@/lib/actions/integrations";

export function DisconnectButton({ integrationId }: { integrationId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await disconnectIntegration(integrationId);
        });
      }}
    >
      {isPending ? "Disconnecting..." : "Disconnect"}
    </Button>
  );
}
