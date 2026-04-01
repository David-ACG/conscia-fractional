"use client";

import * as React from "react";
import { Check, X, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateScope } from "@/lib/actions/engagement";

interface ScopeCardProps {
  engagementId: string;
  scope: string[];
  outOfScope: string[];
}

export function ScopeCard({ engagementId, scope, outOfScope }: ScopeCardProps) {
  const [editing, setEditing] = React.useState(false);
  const [inScope, setInScope] = React.useState(scope);
  const [outScope, setOutScope] = React.useState(outOfScope);
  const [newIn, setNewIn] = React.useState("");
  const [newOut, setNewOut] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateScope(engagementId, inScope, outScope);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Scope updated");
      setEditing(false);
    }
  }

  function addInScope() {
    if (newIn.trim()) {
      setInScope([...inScope, newIn.trim()]);
      setNewIn("");
    }
  }

  function addOutScope() {
    if (newOut.trim()) {
      setOutScope([...outScope, newOut.trim()]);
      setNewOut("");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Scope</CardTitle>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit scope
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* In-scope */}
        <div>
          <h4 className="mb-2 font-medium text-green-700 dark:text-green-400">
            In scope
          </h4>
          <ul className="space-y-1.5">
            {inScope.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{item}</span>
                {editing && (
                  <button
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setInScope(inScope.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editing && (
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Add in-scope item..."
                value={newIn}
                onChange={(e) => setNewIn(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addInScope()}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={addInScope}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {inScope.length === 0 && !editing && (
            <p className="text-muted-foreground">No in-scope items defined.</p>
          )}
        </div>

        {/* Out-of-scope */}
        <div>
          <h4 className="mb-2 font-medium text-muted-foreground">
            Out of scope
          </h4>
          <ul className="space-y-1.5">
            {outScope.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-muted-foreground"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item}</span>
                {editing && (
                  <button
                    className="ml-auto hover:text-destructive"
                    onClick={() =>
                      setOutScope(outScope.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editing && (
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Add out-of-scope item..."
                value={newOut}
                onChange={(e) => setNewOut(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addOutScope()}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={addOutScope}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {outScope.length === 0 && !editing && (
            <p className="text-muted-foreground">
              No out-of-scope items defined.
            </p>
          )}
        </div>

        {editing && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInScope(scope);
                setOutScope(outOfScope);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
