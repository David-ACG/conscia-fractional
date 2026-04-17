"use client";

import * as React from "react";
import { Loader2, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  listTrelloBoardsAction,
  listTrelloListsAction,
  exportTasksToTrelloAction,
} from "@/lib/actions/tasks-export";
import type {
  TrelloBoard,
  TrelloList,
  ExportMode,
  ExportResult,
} from "@/lib/services/trello-export-service";
import type { Task } from "@/lib/types";

type Step = "board" | "mapping" | "preview" | "exporting" | "done";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

const FUZZY_MATCH: Record<TaskStatus, string[]> = {
  todo: ["to do", "todo", "backlog", "inbox"],
  in_progress: ["doing", "in progress", "wip"],
  blocked: ["blocked", "waiting", "on hold"],
  done: ["done", "complete", "shipped"],
};

function pickDefaultListId(
  status: TaskStatus,
  lists: TrelloList[],
): string | null {
  const keywords = FUZZY_MATCH[status];
  for (const keyword of keywords) {
    const match = lists.find((l) => l.name.toLowerCase().includes(keyword));
    if (match) return match.id;
  }
  return null;
}

export interface TrelloExportDialogProps {
  tasks: Task[];
  trelloConnected: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrelloExportDialog({
  tasks,
  open,
  onOpenChange,
}: TrelloExportDialogProps) {
  const [step, setStep] = React.useState<Step>("board");
  const [boards, setBoards] = React.useState<TrelloBoard[] | null>(null);
  const [boardId, setBoardId] = React.useState<string>("");
  const [boardsError, setBoardsError] = React.useState<string | null>(null);
  const [lists, setLists] = React.useState<TrelloList[] | null>(null);
  const [listsError, setListsError] = React.useState<string | null>(null);
  const [mapping, setMapping] = React.useState<Record<TaskStatus, string>>({
    todo: "",
    in_progress: "",
    blocked: "",
    done: "",
  });
  const [mode, setMode] = React.useState<ExportMode>("skip-exported");
  const [result, setResult] = React.useState<ExportResult | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [failuresOpen, setFailuresOpen] = React.useState(false);

  const statusesInTasks = React.useMemo<TaskStatus[]>(() => {
    const set = new Set<TaskStatus>();
    for (const task of tasks) set.add(task.status);
    const ordered: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
    return ordered.filter((s) => set.has(s));
  }, [tasks]);

  const alreadyExportedCount = React.useMemo(
    () => tasks.filter((t) => !!t.trello_card_id).length,
    [tasks],
  );

  const readyToCreate = React.useMemo(
    () =>
      mode === "skip-exported"
        ? tasks.length - alreadyExportedCount
        : tasks.length,
    [tasks.length, alreadyExportedCount, mode],
  );

  const selectedBoard = boards?.find((b) => b.id === boardId) ?? null;

  function resetState() {
    setStep("board");
    setBoards(null);
    setBoardId("");
    setBoardsError(null);
    setLists(null);
    setListsError(null);
    setMapping({ todo: "", in_progress: "", blocked: "", done: "" });
    setMode("skip-exported");
    setResult(null);
    setExportError(null);
    setFailuresOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    resetState();
    setStep("board");
    (async () => {
      const res = await listTrelloBoardsAction();
      if (cancelled) return;
      if (res.error) {
        setBoardsError(res.error);
        setBoards([]);
      } else {
        setBoards(res.boards ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (step !== "mapping" || !boardId) return;
    let cancelled = false;
    setLists(null);
    setListsError(null);
    (async () => {
      const res = await listTrelloListsAction(boardId);
      if (cancelled) return;
      if (res.error) {
        setListsError(res.error);
        setLists([]);
      } else {
        const fetched = res.lists ?? [];
        setLists(fetched);
        setMapping((prev) => {
          const next = { ...prev };
          for (const status of statusesInTasks) {
            if (!next[status]) {
              const defaultId = pickDefaultListId(status, fetched);
              if (defaultId) next[status] = defaultId;
            }
          }
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, boardId, statusesInTasks]);

  const mappingComplete = statusesInTasks.every((s) => !!mapping[s]);

  function handleDialogOpenChange(next: boolean) {
    if (step === "exporting") return;
    onOpenChange(next);
  }

  async function runExport() {
    setStep("exporting");
    setExportError(null);
    const taskIds = tasks.map((t) => t.id);
    const res = await exportTasksToTrelloAction({
      taskIds,
      boardId,
      statusToListMap: mapping,
      mode,
    });
    if (res.error || !res.result) {
      setExportError(res.error ?? "Export failed");
      setResult({ created: 0, skipped: 0, failed: [] });
      setStep("done");
      toast.error(res.error ?? "Trello export failed");
      return;
    }
    setResult(res.result);
    setStep("done");
    if (res.result.created > 0) {
      toast.success(`${res.result.created} tasks exported to Trello`);
    } else if (res.result.failed.length > 0) {
      toast.error("Trello export completed with errors");
    }
  }

  const failureTitleById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) map.set(t.id, t.title);
    return map;
  }, [tasks]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export to Trello</DialogTitle>
          <DialogDescription>
            {step === "board" && "Choose a board to export your tasks to."}
            {step === "mapping" && "Map FractionalBuddy statuses to Trello lists."}
            {step === "preview" && "Review the export before creating cards."}
            {step === "exporting" && "Creating cards in Trello…"}
            {step === "done" && "Export complete."}
          </DialogDescription>
        </DialogHeader>

        {/* Step: board */}
        {step === "board" && (
          <div className="space-y-3">
            {boards === null ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : boardsError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {boardsError}
              </p>
            ) : boards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Trello boards found for this account.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Board</Label>
                <Select value={boardId} onValueChange={setBoardId}>
                  <SelectTrigger data-testid="trello-board-select">
                    <SelectValue placeholder="Select a board" />
                  </SelectTrigger>
                  <SelectContent>
                    {boards.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Step: mapping */}
        {step === "mapping" && (
          <div className="space-y-3">
            {lists === null ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : listsError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {listsError}
              </p>
            ) : lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No lists found on this board. Create at least one list in Trello
                first.
              </p>
            ) : (
              <div className="space-y-3">
                {statusesInTasks.map((status) => (
                  <div
                    key={status}
                    className="grid grid-cols-[120px_1fr] items-center gap-3"
                  >
                    <Label className="text-sm">{STATUS_LABEL[status]}</Label>
                    <Select
                      value={mapping[status]}
                      onValueChange={(v) =>
                        setMapping((prev) => ({ ...prev, [status]: v }))
                      }
                    >
                      <SelectTrigger
                        data-testid={`trello-list-select-${status}`}
                      >
                        <SelectValue placeholder="Select a list" />
                      </SelectTrigger>
                      <SelectContent>
                        {lists.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: preview */}
        {step === "preview" && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                Ready to create: <strong>{readyToCreate}</strong>.
              </p>
              <p className="text-muted-foreground">
                Already have Trello cards:{" "}
                <strong>{alreadyExportedCount}</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Mode</Label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="trello-export-mode"
                    value="skip-exported"
                    checked={mode === "skip-exported"}
                    onChange={() => setMode("skip-exported")}
                  />
                  Skip already-exported (recommended)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="trello-export-mode"
                    value="overwrite"
                    checked={mode === "overwrite"}
                    onChange={() => setMode("overwrite")}
                  />
                  Re-create all
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step: exporting */}
        {step === "exporting" && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm">Exporting your tasks to Trello…</p>
          </div>
        )}

        {/* Step: done */}
        {step === "done" && result && (
          <div className="space-y-3">
            {exportError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {exportError}
              </p>
            ) : (
              <p className="text-sm">
                <span className="text-green-600 dark:text-green-400">✓</span>{" "}
                Created <strong>{result.created}</strong>, skipped{" "}
                <strong>{result.skipped}</strong>, failed{" "}
                <strong>{result.failed.length}</strong>.
              </p>
            )}
            {selectedBoard?.url && (
              <a
                href={selectedBoard.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open board in Trello
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {result.failed.length > 0 && (
              <div className="rounded-md border p-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm font-medium"
                  onClick={() => setFailuresOpen((p) => !p)}
                >
                  {failuresOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {result.failed.length} failure
                  {result.failed.length === 1 ? "" : "s"}
                </button>
                {failuresOpen && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {result.failed.map((f) => (
                      <li key={f.taskId}>
                        <span className="text-foreground">
                          {failureTitleById.get(f.taskId) ?? f.taskId}
                        </span>
                        : {f.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "board" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("mapping")}
                disabled={!boardId}
              >
                Next
              </Button>
            </>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("board")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!mappingComplete}
              >
                Next
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button onClick={runExport} disabled={readyToCreate === 0}>
                Export {readyToCreate} task{readyToCreate === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {step === "exporting" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting…
            </Button>
          )}
          {step === "done" && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
