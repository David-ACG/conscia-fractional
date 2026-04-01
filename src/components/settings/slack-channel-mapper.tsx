"use client";

import * as React from "react";
import { Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Types ---

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

interface ChannelMapping {
  id: string;
  channel_id: string;
  channel_name: string;
  crm_customer_id: string;
}

interface CrmCustomer {
  id: string;
  name: string;
}

interface SlackChannelMapperProps {
  integrationId: string;
  customers: CrmCustomer[];
}

// --- Component ---

export function SlackChannelMapper({
  integrationId,
  customers,
}: SlackChannelMapperProps) {
  const [channels, setChannels] = React.useState<SlackChannel[]>([]);
  const [mappings, setMappings] = React.useState<ChannelMapping[]>([]);
  const [selections, setSelections] = React.useState<Record<string, string>>(
    {},
  );
  const [isLoadingChannels, setIsLoadingChannels] = React.useState(true);
  const [isLoadingMappings, setIsLoadingMappings] = React.useState(true);
  const [savingCustomerId, setSavingCustomerId] = React.useState<string | null>(
    null,
  );
  const [unlinkingId, setUnlinkingId] = React.useState<string | null>(null);
  const [channelsError, setChannelsError] = React.useState<string | null>(null);

  const loadChannels = React.useCallback(async () => {
    setIsLoadingChannels(true);
    setChannelsError(null);
    try {
      const res = await fetch(
        `/api/integrations/slack/channels?integration_id=${integrationId}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load channels");
      }
      const data: SlackChannel[] = await res.json();
      setChannels(data);
    } catch (err) {
      setChannelsError(
        err instanceof Error ? err.message : "Failed to load channels",
      );
    } finally {
      setIsLoadingChannels(false);
    }
  }, [integrationId]);

  const loadMappings = React.useCallback(async () => {
    setIsLoadingMappings(true);
    try {
      const res = await fetch(
        `/api/integrations/slack/mapping?integration_id=${integrationId}`,
      );
      if (!res.ok) return;
      const data: ChannelMapping[] = await res.json();
      setMappings(data);
    } finally {
      setIsLoadingMappings(false);
    }
  }, [integrationId]);

  React.useEffect(() => {
    loadChannels();
    loadMappings();
  }, [loadChannels, loadMappings]);

  const getMappedChannelForCustomer = (
    customerId: string,
  ): ChannelMapping | undefined =>
    mappings.find((m) => m.crm_customer_id === customerId);

  const handleSave = async (customerId: string) => {
    const channelId = selections[customerId];
    if (!channelId) return;

    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return;

    setSavingCustomerId(customerId);
    try {
      // Remove existing mapping for this customer if any
      const existing = getMappedChannelForCustomer(customerId);
      if (existing) {
        await fetch(`/api/integrations/slack/mapping/${existing.id}`, {
          method: "DELETE",
        });
      }

      const res = await fetch("/api/integrations/slack/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_id: integrationId,
          channel_id: channel.id,
          channel_name: channel.name,
          crm_customer_id: customerId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save mapping");
      }

      await loadMappings();
      setSelections((prev) => {
        const next = { ...prev };
        delete next[customerId];
        return next;
      });
    } catch (err) {
      console.error("Failed to save mapping:", err);
    } finally {
      setSavingCustomerId(null);
    }
  };

  const handleUnlink = async (mappingId: string) => {
    setUnlinkingId(mappingId);
    try {
      await fetch(`/api/integrations/slack/mapping/${mappingId}`, {
        method: "DELETE",
      });
      await loadMappings();
    } catch {
      // silent
    } finally {
      setUnlinkingId(null);
    }
  };

  if (isLoadingChannels || isLoadingMappings) {
    return (
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading channels…
      </div>
    );
  }

  if (channelsError) {
    return (
      <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {channelsError}{" "}
        <button className="underline" onClick={loadChannels}>
          Retry
        </button>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No CRM customers found.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium">Channel → Customer Mapping</p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Linked Channel</TableHead>
              <TableHead className="w-44">Change</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => {
              const existing = getMappedChannelForCustomer(customer.id);
              const selected = selections[customer.id];
              const isSaving = savingCustomerId === customer.id;

              return (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {existing ? (
                      <span className="flex items-center gap-2">
                        <span>#{existing.channel_name}</span>
                        <button
                          onClick={() => handleUnlink(existing.id)}
                          disabled={unlinkingId === existing.id}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                          aria-label={`Unlink #${existing.channel_name}`}
                        >
                          {unlinkingId === existing.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Unlink className="h-3 w-3" />
                          )}
                        </button>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={selected ?? ""}
                      onValueChange={(val) =>
                        setSelections((prev) => ({
                          ...prev,
                          [customer.id]: val,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            #{ch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={!selected || isSaving}
                      onClick={() => handleSave(customer.id)}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
