"use client";

import * as React from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Video,
  Monitor,
  Calendar,
  Users,
  CheckCircle,
  CheckSquare,
  Sparkles,
  Mic,
  FileUp,
  Download,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RecordingContainer } from "./recording-container";
import { FileUploadTranscription } from "./file-upload-transcription";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MeetingForm } from "./meeting-form";
import { MeetingDetail } from "./meeting-detail";
import { TranscriptUpload } from "./transcript-upload";
import {
  logMeetingToTimesheet,
  deleteMeeting,
  reprocessMeetingAction,
} from "@/lib/actions/meetings";
import { processUploadedRecordingAction } from "@/lib/actions/recording";
import type { TranscriptSegment } from "@/lib/types/transcription";
import { formatDuration, markdownToHtml } from "@/lib/utils";
import type {
  Meeting,
  CrmCustomer,
  MeetingAttendee,
  MeetingPreFillData,
} from "@/lib/types";

type MeetingWithCustomer = Meeting & {
  crm_customer: { name: string } | null;
};

interface MeetingListProps {
  meetings: MeetingWithCustomer[];
  customers: Pick<CrmCustomer, "id" | "name">[];
  timesheetMeetingIds: Set<string>;
  meetingTaskCounts?: Record<string, number>;
  /** Pre-fill data from a calendar event (passed when navigating from calendar) */
  prefillData?: MeetingPreFillData | null;
  /** When true, auto-open the recording sheet instead of the form */
  recordMode?: boolean;
}

const platformConfig: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  zoom: {
    label: "Zoom",
    icon: Video,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  teams: {
    label: "Teams",
    icon: Monitor,
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  meet: {
    label: "Meet",
    icon: Video,
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

const defaultPlatform = {
  label: "Other",
  icon: Calendar,
  className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function formatMeetingDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function MeetingList({
  meetings,
  customers,
  timesheetMeetingIds,
  meetingTaskCounts = {},
  prefillData,
  recordMode,
}: MeetingListProps) {
  const [search, setSearch] = React.useState("");
  const [platformFilter, setPlatformFilter] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingMeeting, setEditingMeeting] =
    React.useState<MeetingWithCustomer | null>(null);
  const [activePrefillData, setActivePrefillData] =
    React.useState<MeetingPreFillData | null>(prefillData ?? null);
  const hasAutoOpened = React.useRef(false);
  const [detailMeeting, setDetailMeeting] =
    React.useState<MeetingWithCustomer | null>(null);
  const [loggingId, setLoggingId] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletingMeeting, setDeletingMeeting] =
    React.useState<MeetingWithCustomer | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [recordingOpen, setRecordingOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadCustomerId, setUploadCustomerId] = React.useState("");

  // Auto-open form or recording sheet when arriving from calendar
  React.useEffect(() => {
    if (!prefillData || hasAutoOpened.current) return;
    hasAutoOpened.current = true;
    if (recordMode) {
      setRecordingOpen(true);
    } else {
      setEditingMeeting(null);
      setFormOpen(true);
    }
  }, [prefillData, recordMode]);

  const filtered = React.useMemo(() => {
    let result = meetings;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.summary && m.summary.toLowerCase().includes(q)),
      );
    }
    if (platformFilter !== "all") {
      if (platformFilter === "other") {
        result = result.filter((m) => !m.platform);
      } else {
        result = result.filter((m) => m.platform === platformFilter);
      }
    }
    return result;
  }, [meetings, search, platformFilter]);

  function handleEdit(meeting: MeetingWithCustomer) {
    setEditingMeeting(meeting);
    setFormOpen(true);
  }

  function handleCloseForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingMeeting(null);
  }

  async function handleLogToTimesheet(meeting: MeetingWithCustomer) {
    setLoggingId(meeting.id);
    const result = await logMeetingToTimesheet(meeting.id);
    setLoggingId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Meeting logged to timesheet");
    }
  }

  async function handleDelete() {
    if (!deletingMeeting) return;
    setDeleting(true);
    const result = await deleteMeeting(deletingMeeting.id);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Meeting deleted");
      setDeleteOpen(false);
      setDeletingMeeting(null);
    }
  }

  const platformFilters = [
    { value: "all", label: "All" },
    { value: "zoom", label: "Zoom" },
    { value: "teams", label: "Teams" },
    { value: "meet", label: "Meet" },
    { value: "other", label: "Other" },
  ];

  return (
    <TooltipProvider>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-1">
          {platformFilters.map((pf) => (
            <Button
              key={pf.value}
              variant={platformFilter === pf.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPlatformFilter(pf.value)}
            >
              {pf.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTranscriptOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Process Recording
          </Button>
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Upload Recording
          </Button>
          <Button variant="outline" onClick={() => setRecordingOpen(true)}>
            <Mic className="mr-2 h-4 w-4" />
            Record Meeting
          </Button>
          <Button
            onClick={() => {
              setEditingMeeting(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Meeting
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {search || platformFilter !== "all"
              ? "No meetings match your filters."
              : "No meetings logged yet. Record your meetings and keep notes."}
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meeting Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Attendees</TableHead>
                <TableHead>Timesheet</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((meeting) => {
                const pConfig =
                  meeting.platform && platformConfig[meeting.platform]
                    ? platformConfig[meeting.platform]
                    : defaultPlatform;
                const PlatformIcon = pConfig.icon;
                const isLogged = timesheetMeetingIds.has(meeting.id);
                const attendees = (meeting.attendees ||
                  []) as MeetingAttendee[];

                return (
                  <TableRow
                    key={meeting.id}
                    className="cursor-pointer"
                    onClick={() => setDetailMeeting(meeting)}
                  >
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatMeetingDate(meeting.meeting_date)}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{meeting.title}</span>
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground text-sm max-w-[150px] truncate"
                      title={meeting.original_filename ?? undefined}
                    >
                      {meeting.original_filename ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {meeting.crm_customer?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={pConfig.className}>
                        <PlatformIcon className="mr-1 h-3 w-3" />
                        {pConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {meeting.actual_duration_seconds != null &&
                      meeting.duration_minutes
                        ? `${formatDuration(Math.ceil(meeting.actual_duration_seconds / 60))} / ${formatDuration(meeting.duration_minutes)}`
                        : meeting.duration_minutes
                          ? formatDuration(meeting.duration_minutes)
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {attendees.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary">
                              <Users className="mr-1 h-3 w-3" />
                              {attendees.length}{" "}
                              {attendees.length === 1 ? "person" : "people"}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {attendees.map((a, i) => (
                              <div key={i}>
                                {a.name}
                                {a.role ? ` (${a.role})` : ""}
                              </div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isLogged ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Logged
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={loggingId === meeting.id}
                          onClick={() => handleLogToTimesheet(meeting)}
                        >
                          {loggingId === meeting.id ? "Logging..." : "Log"}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {meetingTaskCounts[meeting.id] ? (
                        <Badge variant="secondary">
                          <CheckSquare className="mr-1 h-3 w-3" />
                          {meetingTaskCounts[meeting.id]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(meeting);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation();
                              toast.loading("Fetching transcript...", {
                                id: "dl-transcript",
                              });
                              const res = await fetch(
                                `/api/meetings/${meeting.id}/transcript-text`,
                              );
                              toast.dismiss("dl-transcript");
                              if (!res.ok) {
                                toast.error("Failed to fetch transcript");
                                return;
                              }
                              const { transcript } = await res.json();
                              if (!transcript) {
                                toast.error("No transcript available");
                                return;
                              }
                              const blob = new Blob([transcript], {
                                type: "text/plain",
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${meeting.title.replace(/[^a-zA-Z0-9 ]/g, "").trim()}-transcript.txt`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download Transcript (.txt)
                          </DropdownMenuItem>
                          {meeting.summary && (
                            <>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const blob = new Blob([meeting.summary!], {
                                    type: "text/markdown",
                                  });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `${meeting.title.replace(/[^a-zA-Z0-9 ]/g, "").trim()}-summary.md`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Download Summary (.md)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const summaryHtml = markdownToHtml(
                                    meeting.summary!,
                                  );
                                  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${meeting.title} - Summary</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
  h1 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h2 { font-size: 1.25em; }
  h3 { font-size: 1.1em; }
  ul, ol { padding-left: 2em; }
  li { margin-bottom: 0.25em; }
  strong { font-weight: 600; }
  code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
  blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1em; color: #666; }
</style>
</head><body>${summaryHtml}</body></html>`;
                                  const printWindow = window.open("", "_blank");
                                  if (printWindow) {
                                    printWindow.document.write(html);
                                    printWindow.document.close();
                                    printWindow.print();
                                  }
                                }}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Download Summary (.pdf)
                              </DropdownMenuItem>
                            </>
                          )}
                          {
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                toast.loading("Re-processing with Claude...", {
                                  id: "reprocess",
                                });
                                const result = await reprocessMeetingAction(
                                  meeting.id,
                                );
                                toast.dismiss("reprocess");
                                if ("error" in result) {
                                  toast.error(result.error);
                                } else {
                                  toast.success(
                                    "Meeting re-processed successfully",
                                  );
                                }
                              }}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Re-process with Claude
                            </DropdownMenuItem>
                          }
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingMeeting(meeting);
                              setDeleteOpen(true);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <MeetingForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        meeting={editingMeeting}
        customers={customers}
        prefillData={editingMeeting ? null : activePrefillData}
        onClear={() => setActivePrefillData(null)}
      />

      {/* Detail sheet */}
      <MeetingDetail
        meeting={detailMeeting}
        open={!!detailMeeting}
        onOpenChange={(open) => {
          if (!open) setDetailMeeting(null);
        }}
        isLogged={
          detailMeeting ? timesheetMeetingIds.has(detailMeeting.id) : false
        }
        onLogToTimesheet={handleLogToTimesheet}
        loggingId={loggingId}
        onEdit={handleEdit}
      />

      {/* Delete confirmation */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setDeleteOpen(false)}
          />
          <div className="relative z-50 rounded-lg border bg-background p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold">Delete meeting</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete &ldquo;{deletingMeeting?.title}
              &rdquo;? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Transcript upload */}
      <TranscriptUpload
        open={transcriptOpen}
        onOpenChange={setTranscriptOpen}
      />

      {/* Recording sheet */}
      <Sheet open={recordingOpen} onOpenChange={setRecordingOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Record Meeting</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <RecordingContainer
              onComplete={() => setRecordingOpen(false)}
              onDiscard={() => setRecordingOpen(false)}
              prefillData={activePrefillData}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Upload recording sheet */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Upload Recording</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {customers.length > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="upload-customer"
                  className="text-sm font-medium"
                >
                  Customer
                </label>
                <select
                  id="upload-customer"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={uploadCustomerId}
                  onChange={(e) => setUploadCustomerId(e.target.value)}
                >
                  <option value="">None</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <FileUploadTranscription
              onComplete={async (data: {
                segments: TranscriptSegment[];
                audioUrl: string;
                durationSeconds: number;
                fileName: string;
              }) => {
                toast.loading("Processing recording...", {
                  id: "upload-process",
                });
                const formData = new FormData();
                formData.append("segments", JSON.stringify(data.segments));
                formData.append("audioUrl", data.audioUrl);
                formData.append("duration", String(data.durationSeconds));
                formData.append("fileName", data.fileName);
                if (uploadCustomerId) {
                  formData.append("crm_customer_id", uploadCustomerId);
                }
                const result = await processUploadedRecordingAction(formData);
                toast.dismiss("upload-process");
                if ("error" in result) {
                  toast.error(result.error);
                } else {
                  toast.success(`Recording processed: ${data.fileName}`);
                }
              }}
              onDiscard={() => setUploadOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
