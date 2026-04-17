"use client";

import { useState, useTransition } from "react";
import {
  Clock,
  CheckSquare,
  Users,
  FileOutput,
  Receipt,
  StickyNote,
  Search,
  Building2,
  Copy,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  updatePortalSetting,
  invitePortalUser,
  revokePortalUser,
} from "@/lib/actions/portal";
import { PORTAL_MODULES } from "@/lib/types";
import type { PortalSettings, PortalInvitation } from "@/lib/types";

const moduleDescriptions: Record<
  string,
  { label: string; description: string; icon: LucideIcon }
> = {
  timesheet: {
    label: "Timesheet",
    description: "Time entries and hours summary",
    icon: Clock,
  },
  meetings: {
    label: "Meetings",
    description: "Meeting summaries and action items (no transcripts)",
    icon: Users,
  },
  deliverables: {
    label: "Deliverables",
    description: "Deliverable files and version history",
    icon: FileOutput,
  },
  invoicing: {
    label: "Invoicing",
    description: "Invoice list and payment status",
    icon: Receipt,
  },
  notes: {
    label: "Notes",
    description: "Shared notes and decisions",
    icon: StickyNote,
  },
  research: {
    label: "Research",
    description: "Research findings and analysis",
    icon: Search,
  },
  customers: {
    label: "Customers",
    description: "CRM customers you are working on",
    icon: Building2,
  },
};

const statusBadgeConfig: Record<string, { label: string; className: string }> =
  {
    pending: {
      label: "Pending",
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    accepted: {
      label: "Active",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    revoked: {
      label: "Revoked",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    },
  };

interface PortalSharingSettingsProps {
  clientId: string;
  settings: PortalSettings[];
  invitations: PortalInvitation[];
}

export function PortalSharingSettings({
  clientId,
  settings,
  invitations,
}: PortalSharingSettingsProps) {
  const settingsMap = new Map(settings.map((s) => [s.module, s.is_enabled]));

  return (
    <div className="space-y-6">
      <ModuleToggles clientId={clientId} settingsMap={settingsMap} />
      <PortalUsers clientId={clientId} invitations={invitations} />
    </div>
  );
}

// ─── Module Toggles ────────────────────────────────────────────────

function ModuleToggles({
  clientId,
  settingsMap,
}: {
  clientId: string;
  settingsMap: Map<string, boolean>;
}) {
  const [toggles, setToggles] = useState<Map<string, boolean>>(
    () => new Map(settingsMap),
  );
  const [isPending, startTransition] = useTransition();

  function handleToggle(module: string, checked: boolean) {
    const previous = toggles.get(module) ?? false;
    setToggles((prev) => new Map(prev).set(module, checked));

    startTransition(async () => {
      const result = await updatePortalSetting(clientId, module, checked);
      if (result.error) {
        setToggles((prev) => new Map(prev).set(module, previous));
        toast.error(result.error);
      } else {
        toast.success(
          `${moduleDescriptions[module]?.label ?? module} ${checked ? "enabled" : "disabled"}`,
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Module Visibility</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose which modules are visible to clients in the portal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {PORTAL_MODULES.map((mod) => {
          const info = moduleDescriptions[mod];
          if (!info) return null;
          const Icon = info.icon;
          const enabled = toggles.get(mod) ?? false;

          return (
            <div
              key={mod}
              className="flex items-center justify-between gap-4 py-1"
            >
              <div className="flex items-center gap-3">
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <div>
                  <Label
                    htmlFor={`module-${mod}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {info.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {info.description}
                  </p>
                </div>
              </div>
              <Switch
                id={`module-${mod}`}
                checked={enabled}
                disabled={isPending}
                onCheckedChange={(checked) => handleToggle(mod, checked)}
              />
            </div>
          );
        })}

        <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/30 p-3 text-sm">
          <CheckSquare className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Tasks are shared via Trello</p>
            <p className="text-xs text-muted-foreground">
              The portal no longer includes a Tasks tab. Export tasks to a client
              Trello board from the{" "}
              <Link href="/tasks" className="underline hover:text-foreground">
                Tasks page
              </Link>
              {" "}and connect Trello in the integrations above.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Portal Users ──────────────────────────────────────────────────

function PortalUsers({
  clientId,
  invitations: initialInvitations,
}: {
  clientId: string;
  invitations: PortalInvitation[];
}) {
  const [invitations, setInvitations] =
    useState<PortalInvitation[]>(initialInvitations);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }

    startTransition(async () => {
      const result = await invitePortalUser(clientId, email);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Invitation sent to ${email}`);
        setGeneratedLink(result.link ?? null);
        setInvitations((prev) => [
          {
            id: crypto.randomUUID(),
            client_id: clientId,
            email,
            invited_by: "",
            auth_user_id: null,
            status: "pending" as const,
            invited_at: new Date().toISOString(),
            accepted_at: null,
            last_login: null,
          },
          ...prev,
        ]);
        setEmail("");
      }
    });
  }

  function handleRevoke(invitationId: string) {
    startTransition(async () => {
      const result = await revokePortalUser(invitationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Access revoked");
        setInvitations((prev) =>
          prev.map((inv) =>
            inv.id === invitationId
              ? { ...inv, status: "revoked" as const }
              : inv,
          ),
        );
      }
    });
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Portal Users</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Manage who can access the client portal.
          </p>
        </div>
        <Dialog
          open={inviteOpen}
          onOpenChange={(open) => {
            setInviteOpen(open);
            if (!open) {
              setEmail("");
              setGeneratedLink(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="mr-1.5 size-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Portal User</DialogTitle>
              <DialogDescription>
                Send a portal invitation to a client contact. They will receive
                a magic link to access the portal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="client@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInvite();
                  }}
                />
              </div>
              {generatedLink && (
                <div className="space-y-2">
                  <Label>Invite Link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={generatedLink} className="text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyLink(generatedLink)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with the client to give them portal access.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleInvite} disabled={isPending}>
                {isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No portal users invited yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => {
                const badge = statusBadgeConfig[inv.status] ?? {
                  label: inv.status,
                  className: "",
                };
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.invited_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.last_login
                        ? new Date(inv.last_login).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyLink(`${window.location.origin}/portal`)
                            }
                          >
                            <Copy className="mr-1 size-3.5" />
                            Copy Link
                          </Button>
                        )}
                        {inv.status !== "revoked" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                Revoke
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Revoke portal access?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {inv.email}&apos;s access to
                                  the client portal. They will no longer be able
                                  to view any shared data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRevoke(inv.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Revoke Access
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
