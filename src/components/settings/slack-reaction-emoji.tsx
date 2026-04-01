"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SlackReactionEmojiProps {
  integrationId: string;
  taskReactionEmoji: string;
}

export function SlackReactionEmoji({
  integrationId,
  taskReactionEmoji: initialEmoji,
}: SlackReactionEmojiProps) {
  const [emoji, setEmoji] = useState(initialEmoji || "white_check_mark");
  const [saving, setSaving] = useState(false);

  async function save(value: string) {
    setSaving(true);
    try {
      await fetch(`/api/integrations/${integrationId}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_reaction_emoji: value }),
      });
    } catch (err) {
      console.error("Failed to save reaction emoji:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-1">
      <Label htmlFor={`reaction-emoji-${integrationId}`} className="text-sm">
        Create task from Slack reaction
      </Label>
      <Input
        id={`reaction-emoji-${integrationId}`}
        value={emoji}
        disabled={saving}
        onChange={(e) => setEmoji(e.target.value)}
        onBlur={() => save(emoji)}
        placeholder="white_check_mark"
        className="h-8 text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Enter Slack emoji name without colons (e.g.{" "}
        <code>white_check_mark</code> for ✅)
      </p>
    </div>
  );
}
