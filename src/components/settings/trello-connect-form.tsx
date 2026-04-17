"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_KEY_REGEX = /^[a-f0-9]{32}$/i;

export function TrelloConnectForm() {
  const [apiKey, setApiKey] = useState("");
  const isValid = API_KEY_REGEX.test(apiKey);

  return (
    <form
      method="POST"
      action="/api/auth/trello"
      className="mt-3 space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="trello-api-key" className="text-xs font-medium">
          Trello API Key
        </Label>
        <Input
          id="trello-api-key"
          name="apiKey"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value.trim())}
          placeholder="32-character hex string"
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Grab your API key from{" "}
          <a
            href="https://trello.com/app-key"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            trello.com/app-key
          </a>
          . After connecting, you&apos;ll be asked to authorize FractionalBuddy.
        </p>
      </div>
      <Button type="submit" size="sm" disabled={!isValid}>
        Connect Trello
      </Button>
    </form>
  );
}
