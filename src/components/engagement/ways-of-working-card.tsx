"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Send, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createQuestionnaire,
  sendQuestionnaire,
} from "@/lib/actions/questionnaire";
import type { EngagementQuestionnaire } from "@/lib/types";

interface WaysOfWorkingCardProps {
  engagementId: string;
  clientId: string;
  questionnaire: EngagementQuestionnaire | null;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  completed: "Completed",
  reviewed: "Reviewed",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  partial: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400",
  reviewed: "bg-green-500/10 text-green-700 dark:text-green-400",
};

export function WaysOfWorkingCard({
  engagementId,
  clientId,
  questionnaire,
}: WaysOfWorkingCardProps) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const status = questionnaire?.status ?? "not_created";
  const answers = (questionnaire?.answers ?? {}) as Record<string, unknown>;
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] !== null && answers[k] !== "",
  ).length;

  async function handleCreate() {
    setLoading(true);
    const result = await createQuestionnaire(engagementId, clientId);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Questionnaire created");
      router.refresh();
    }
  }

  async function handleSend() {
    if (!questionnaire || !email.trim()) return;
    setLoading(true);
    const result = await sendQuestionnaire(questionnaire.id, email.trim());
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Questionnaire sent to ${email}`);
      setSendOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">
            Ways of Working
          </CardTitle>
          {questionnaire && (
            <Badge className={statusColors[status] ?? ""}>
              {statusLabels[status] ?? "Not sent"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!questionnaire ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                No questionnaire created yet.
              </p>
              <Button size="sm" onClick={handleCreate} disabled={loading}>
                <ClipboardList className="mr-1.5 h-4 w-4" />
                {loading ? "Creating..." : "Create Questionnaire"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {answeredCount > 0 && (
                <p className="text-muted-foreground">
                  {answeredCount} answer{answeredCount !== 1 ? "s" : ""}{" "}
                  received
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {(status === "draft" || status === "sent") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSendOpen(true)}
                  >
                    <Send className="mr-1.5 h-4 w-4" />
                    {status === "sent" ? "Resend" : "Send"} Questionnaire
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/engagement/questionnaire")}
                >
                  <Eye className="mr-1.5 h-4 w-4" />
                  {status === "completed" || status === "reviewed"
                    ? "View Answers"
                    : "Fill In"}
                </Button>
              </div>

              {questionnaire.sent_to_email && (
                <p className="text-xs text-muted-foreground">
                  Sent to {questionnaire.sent_to_email}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Questionnaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="send-email">Client email</Label>
            <Input
              id="send-email"
              type="email"
              placeholder="contact@client.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              They&apos;ll receive a link to{" "}
              <code className="text-xs">/onboarding/{engagementId}</code>
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={loading || !email.trim()}>
              {loading ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
