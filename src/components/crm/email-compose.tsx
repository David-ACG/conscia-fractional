"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Save, AlertCircle } from "lucide-react";

export interface ReplyContext {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  inReplyTo?: string;
  references?: string;
}

interface SendIntegration {
  id: string;
  account_identifier: string | null;
}

interface Contact {
  email: string;
}

interface EmailComposeProps {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: ReplyContext;
  onSent?: () => void;
}

export function EmailCompose({
  customerId,
  open,
  onOpenChange,
  replyTo,
  onSent,
}: EmailComposeProps) {
  const [integrations, setIntegrations] = useState<SendIntegration[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  // Load integrations with send access and customer contacts
  useEffect(() => {
    if (!open) return;

    setLoadingInit(true);

    Promise.all([
      fetch("/api/integrations/google/gmail/integrations").then((r) =>
        r.json(),
      ),
      fetch(`/api/crm/customers/${customerId}/contacts`).then((r) => r.json()),
    ])
      .then(([intData, contactData]) => {
        const allInts: SendIntegration[] = intData.integrations ?? [];
        // Filter to those with send scope — we check server-side too,
        // but prefilter here for the selector
        const sendInts =
          (intData.sendIntegrations as SendIntegration[]) ?? allInts;
        setIntegrations(sendInts);
        if (sendInts.length > 0 && !selectedIntegrationId) {
          setSelectedIntegrationId(sendInts[0].id);
        }

        const contactList: Contact[] = contactData.contacts ?? [];
        setContacts(contactList);

        // Pre-populate fields
        if (replyTo) {
          setTo(replyTo.from);
          setSubject(
            replyTo.subject.startsWith("Re:")
              ? replyTo.subject
              : `Re: ${replyTo.subject}`,
          );
          setBody(`\n\n--- Original message ---\n${replyTo.snippet}`);
        } else {
          // Pre-populate To from first contact if available
          if (contactList.length > 0 && !to) {
            setTo(contactList[0].email);
          }
          setSubject("");
          setBody("");
        }
      })
      .catch(() => {
        // Silent — will show no-send-access message if integrations empty
      })
      .finally(() => setLoadingInit(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId]);

  function resetForm() {
    setTo("");
    setCc("");
    setSubject("");
    setBody("");
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim()) {
      toast.error("To and Subject are required");
      return;
    }
    if (!selectedIntegrationId) {
      toast.error("No Gmail account with send access selected");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/integrations/google/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_id: selectedIntegrationId,
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          body: body,
          thread_id: replyTo?.threadId,
          in_reply_to: replyTo?.inReplyTo,
          references: replyTo?.references,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Send failed (${res.status})`);
      }

      toast.success("Email sent");
      handleClose();
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft() {
    if (!to.trim() || !subject.trim()) {
      toast.error("To and Subject are required");
      return;
    }
    if (!selectedIntegrationId) {
      toast.error("No Gmail account with send access selected");
      return;
    }

    setSavingDraft(true);
    try {
      const res = await fetch("/api/integrations/google/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_id: selectedIntegrationId,
          to: to.trim(),
          subject: subject.trim(),
          body: body,
          thread_id: replyTo?.threadId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Draft save failed (${res.status})`);
      }

      toast.success("Draft saved to Gmail");
      handleClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  }

  const noSendAccess = !loadingInit && integrations.length === 0;
  const isSubmitting = sending || savingDraft;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{replyTo ? "Reply" : "Compose Email"}</DialogTitle>
        </DialogHeader>

        {noSendAccess ? (
          <div
            className="flex flex-col items-center gap-3 py-8 text-center"
            data-testid="no-send-access"
          >
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              No Gmail account with send access connected.
            </p>
            <Button asChild size="sm">
              <a href="/dashboard/settings">Add Send Access in Settings</a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* From selector (multiple send-capable accounts) */}
            {integrations.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="compose-from">From</Label>
                <select
                  id="compose-from"
                  value={selectedIntegrationId}
                  onChange={(e) => setSelectedIntegrationId(e.target.value)}
                  className="w-full text-sm rounded-md border px-3 py-2 bg-background"
                  data-testid="compose-from-select"
                >
                  {integrations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.account_identifier ?? i.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* To */}
            <div className="space-y-1.5">
              <Label htmlFor="compose-to">To</Label>
              {contacts.length > 1 ? (
                <select
                  id="compose-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full text-sm rounded-md border px-3 py-2 bg-background"
                  data-testid="compose-to-select"
                >
                  {contacts.map((c) => (
                    <option key={c.email} value={c.email}>
                      {c.email}
                    </option>
                  ))}
                  {replyTo &&
                    !contacts.some((c) => c.email === replyTo.from) && (
                      <option value={replyTo.from}>{replyTo.from}</option>
                    )}
                </select>
              ) : (
                <Input
                  id="compose-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  data-testid="compose-to-input"
                />
              )}
            </div>

            {/* CC */}
            <div className="space-y-1.5">
              <Label htmlFor="compose-cc">CC</Label>
              <Input
                id="compose-cc"
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="Optional"
                data-testid="compose-cc-input"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                data-testid="compose-subject-input"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="compose-body">Message</Label>
              <Textarea
                id="compose-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                rows={8}
                data-testid="compose-body-textarea"
              />
            </div>
          </div>
        )}

        {!noSendAccess && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSubmitting || loadingInit}
              data-testid="compose-save-draft"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {savingDraft ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={isSubmitting || loadingInit}
              data-testid="compose-send"
            >
              <Send className="h-4 w-4 mr-1.5" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
