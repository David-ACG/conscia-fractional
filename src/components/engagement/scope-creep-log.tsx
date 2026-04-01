"use client";

import * as React from "react";
import { format } from "date-fns";
import { Plus, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createScopeCreepEntry,
  updateScopeCreepStatus,
  deleteScopeCreepEntry,
} from "@/lib/actions/engagement";
import type { ScopeCreepEntry } from "@/lib/types";

interface ScopeCreepLogProps {
  engagementId: string;
  clientId: string;
  entries: ScopeCreepEntry[];
}

const statusColors: Record<string, string> = {
  logged: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  discussed: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  accepted: "bg-green-500/10 text-green-700 dark:text-green-400",
  declined: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function ScopeCreepLog({
  engagementId,
  clientId,
  entries,
}: ScopeCreepLogProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [requestedBy, setRequestedBy] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleAdd() {
    if (!description.trim()) return;
    setSaving(true);
    const result = await createScopeCreepEntry(engagementId, clientId, {
      description: description.trim(),
      requested_by: requestedBy.trim(),
      notes: notes.trim(),
    });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Scope creep entry logged");
      setDescription("");
      setRequestedBy("");
      setNotes("");
      setDialogOpen(false);
    }
  }

  async function handleStatusChange(
    entryId: string,
    status: "logged" | "discussed" | "accepted" | "declined",
  ) {
    const result = await updateScopeCreepStatus(entryId, status);
    if (result.error) toast.error(result.error);
  }

  async function handleDelete(entryId: string) {
    const result = await deleteScopeCreepEntry(entryId);
    if (result.error) toast.error(result.error);
    else toast.success("Entry removed");
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">
            Scope Creep Tracker
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Log New
          </Button>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No scope creep logged yet. That&apos;s a good sign.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{entry.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {entry.requested_by && (
                          <span>From: {entry.requested_by}</span>
                        )}
                        <span>
                          {format(new Date(entry.requested_date), "d MMM yyyy")}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={entry.status}
                        onValueChange={(v) =>
                          handleStatusChange(
                            entry.id,
                            v as
                              | "logged"
                              | "discussed"
                              | "accepted"
                              | "declined",
                          )
                        }
                      >
                        <SelectTrigger className="h-7 w-auto">
                          <Badge className={statusColors[entry.status] ?? ""}>
                            {entry.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="logged">Logged</SelectItem>
                          <SelectItem value="discussed">Discussed</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Scope Creep Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="sc-desc">Description</Label>
              <Textarea
                id="sc-desc"
                placeholder="What was requested?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sc-by">Requested by</Label>
              <Input
                id="sc-by"
                placeholder="Name"
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sc-notes">Notes</Label>
              <Textarea
                id="sc-notes"
                placeholder="Any context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving || !description.trim()}
            >
              {saving ? "Saving..." : "Log Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
