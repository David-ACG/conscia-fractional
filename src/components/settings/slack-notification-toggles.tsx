"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SlackNotificationTogglesProps {
  integrationId: string;
  notifyMeetingSummaries: boolean;
  notifyTaskUpdates: boolean;
}

export function SlackNotificationToggles({
  integrationId,
  notifyMeetingSummaries: initialMeetings,
  notifyTaskUpdates: initialTasks,
}: SlackNotificationTogglesProps) {
  const [meetingEnabled, setMeetingEnabled] = useState(initialMeetings);
  const [taskEnabled, setTaskEnabled] = useState(initialTasks);
  const [saving, setSaving] = useState(false);

  async function updateMetadata(patch: Record<string, boolean>) {
    setSaving(true);
    try {
      await fetch(`/api/integrations/${integrationId}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      console.error("Failed to save notification setting:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        <Switch
          id={`meeting-summaries-${integrationId}`}
          checked={meetingEnabled}
          disabled={saving}
          onCheckedChange={(checked) => {
            setMeetingEnabled(checked);
            updateMetadata({ notify_meeting_summaries: checked });
          }}
        />
        <Label
          htmlFor={`meeting-summaries-${integrationId}`}
          className="text-sm cursor-pointer"
        >
          Post meeting summaries to Slack
        </Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={`task-updates-${integrationId}`}
          checked={taskEnabled}
          disabled={saving}
          onCheckedChange={(checked) => {
            setTaskEnabled(checked);
            updateMetadata({ notify_task_updates: checked });
          }}
        />
        <Label
          htmlFor={`task-updates-${integrationId}`}
          className="text-sm cursor-pointer"
        >
          Post task updates to Slack
        </Label>
      </div>
    </div>
  );
}
