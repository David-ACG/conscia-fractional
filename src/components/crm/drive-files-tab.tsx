"use client";

import * as React from "react";
import { formatDistanceToNow, parseISO, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  ExternalLink,
  RefreshCw,
  HardDrive,
  ChevronUp,
  ChevronDown,
  Settings,
  Loader2,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getLinkedFolders, unlinkFolder } from "@/lib/actions/drive";
import { DriveFolderPicker } from "./drive-folder-picker";

// --- Types ---

type LinkedFolder = {
  id: string;
  crm_customer_id: string;
  integration_id: string;
  folder_id: string;
  folder_name: string;
  created_at: string;
  last_synced_at?: string | null;
  integrations?: { account_identifier: string } | null;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number | string | null;
  modifiedTime?: string | null;
  webViewLink?: string | null;
  thumbnailLink?: string | null;
};

type SortField = "name" | "modified";
type SortDirection = "asc" | "desc";

// --- Utilities ---

export function getFileIcon(mimeType: string): React.ElementType {
  if (!mimeType) return File;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType === "application/vnd.google-apps.document") return FileText;
  if (mimeType === "application/vnd.google-apps.spreadsheet")
    return FileSpreadsheet;
  if (mimeType === "application/vnd.google-apps.presentation") return FileText;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return FileText;
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return FileSpreadsheet;
  return File;
}

export function formatFileSize(
  bytes: number | string | null | undefined,
): string {
  if (bytes == null) return "—";
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(b) || b === 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatModified(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

function sortFiles(
  files: DriveFile[],
  field: SortField,
  direction: SortDirection,
): DriveFile[] {
  return [...files].sort((a, b) => {
    let cmp = 0;
    if (field === "name") {
      cmp = (a.name ?? "").localeCompare(b.name ?? "");
    } else {
      const da = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
      const db = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
      cmp = da - db;
    }
    return direction === "asc" ? cmp : -cmp;
  });
}

// --- Props ---

interface DriveFilesTabProps {
  crmCustomerId: string;
  crmCustomerName: string;
}

// --- Component ---

export function DriveFilesTab({
  crmCustomerId,
  crmCustomerName,
}: DriveFilesTabProps) {
  const [linkedFolders, setLinkedFolders] = React.useState<LinkedFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(
    null,
  );
  const [files, setFiles] = React.useState<DriveFile[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false);
  const [nextPageToken, setNextPageToken] = React.useState<string | null>(null);
  const [sortField, setSortField] = React.useState<SortField>("modified");
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>("desc");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [unlinkConfirmId, setUnlinkConfirmId] = React.useState<string | null>(
    null,
  );
  const [lastFetched, setLastFetched] = React.useState<Date | null>(null);
  const [filesError, setFilesError] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const loadFolders = React.useCallback(async () => {
    setIsLoadingFolders(true);
    try {
      const data = await getLinkedFolders(crmCustomerId);
      setLinkedFolders(data as LinkedFolder[]);
      if (data.length > 0 && !selectedFolderId) {
        setSelectedFolderId((data[0] as LinkedFolder).id);
      }
    } catch {
      // folders failed to load — leave empty
    } finally {
      setIsLoadingFolders(false);
    }
  }, [crmCustomerId, selectedFolderId]);

  React.useEffect(() => {
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmCustomerId]);

  const selectedFolder = linkedFolders.find((f) => f.id === selectedFolderId);

  const fetchFiles = React.useCallback(
    async (pageToken?: string) => {
      if (!selectedFolder) return;
      setIsLoadingFiles(true);
      setFilesError(null);
      try {
        const params = new URLSearchParams({
          folder_id: selectedFolder.folder_id,
          integration_id: selectedFolder.integration_id,
          crm_drive_folder_id: selectedFolder.id,
        });
        if (pageToken) params.set("page_token", pageToken);

        const res = await fetch(
          `/api/integrations/google/drive/files?${params.toString()}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to load files");
        }
        const data = await res.json();
        if (pageToken) {
          setFiles((prev) => [...prev, ...(data.files ?? [])]);
        } else {
          setFiles(data.files ?? []);
        }
        setNextPageToken(data.nextPageToken ?? null);
        setLastFetched(new Date());
      } catch (err) {
        setFilesError(
          err instanceof Error ? err.message : "Failed to load files",
        );
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [selectedFolder],
  );

  React.useEffect(() => {
    if (selectedFolder) {
      setFiles([]);
      setNextPageToken(null);
      fetchFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "modified" ? "desc" : "asc");
    }
  };

  const handleUnlink = async (folderId: string) => {
    try {
      await unlinkFolder(folderId);
      const updated = linkedFolders.filter((f) => f.id !== folderId);
      setLinkedFolders(updated);
      if (selectedFolderId === folderId) {
        setSelectedFolderId(updated.length > 0 ? updated[0].id : null);
        setFiles([]);
        setNextPageToken(null);
      }
    } catch {
      // silently fail — folder stays linked
    } finally {
      setUnlinkConfirmId(null);
    }
  };

  const handleSync = async () => {
    if (!selectedFolder) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/integrations/google/drive/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crm_drive_folder_id: selectedFolder.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(`Sync failed: ${err.error ?? "Unknown error"}`);
        return;
      }
      const result = await res.json();
      const { added, updated, removed } = result;
      if (added === 0 && updated === 0 && removed === 0) {
        toast.success("Already up to date");
      } else {
        toast.success(
          `Synced: ${added} new, ${updated} updated, ${removed} removed`,
        );
      }
      // Refresh folder list (to pick up updated last_synced_at) and file list
      await loadFolders();
      await fetchFiles();
    } catch {
      toast.error("Sync failed: Network error");
    } finally {
      setIsSyncing(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedFiles = sortFiles(files, sortField, sortDirection);

  // --- Loading state ---
  if (isLoadingFolders) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // --- Empty state: no folders linked ---
  if (linkedFolders.length === 0) {
    return (
      <div className="py-12 text-center">
        <HardDrive className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="mb-1 font-medium">No Google Drive folders linked</p>
        <p className="mb-4 text-sm text-muted-foreground">
          Link a folder from Google Drive to see files for {crmCustomerName}{" "}
          here.
        </p>
        <Button onClick={() => setPickerOpen(true)}>
          Link Google Drive Folder
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          No Google account connected?{" "}
          <a
            href="/settings"
            className="underline hover:text-foreground"
            data-testid="go-to-settings"
          >
            Go to Settings
          </a>
        </p>
        <DriveFolderPicker
          crmCustomerId={crmCustomerId}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onFolderLinked={loadFolders}
        />
      </div>
    );
  }

  // --- Folders linked ---
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {linkedFolders.length === 1 ? (
          <span className="font-medium">{selectedFolder?.folder_name}</span>
        ) : (
          <Select
            value={selectedFolderId ?? ""}
            onValueChange={(val) => setSelectedFolderId(val)}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {linkedFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.folder_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedFolder?.integrations?.account_identifier && (
          <span className="text-sm text-muted-foreground">
            {selectedFolder.integrations.account_identifier}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedFolder?.last_synced_at ? (
            <span
              className={
                differenceInMinutes(
                  new Date(),
                  parseISO(selectedFolder.last_synced_at),
                ) > 30
                  ? "text-xs text-amber-500"
                  : "text-xs text-muted-foreground"
              }
            >
              Last synced{" "}
              {formatDistanceToNow(parseISO(selectedFolder.last_synced_at), {
                addSuffix: true,
              })}
            </span>
          ) : lastFetched ? (
            <span className="text-xs text-muted-foreground">
              Last fetched{" "}
              {formatDistanceToNow(lastFetched, { addSuffix: true })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Not synced yet
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing || isLoadingFiles}
            aria-label="Sync now"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            + Link
          </Button>
          {selectedFolder &&
            (unlinkConfirmId === selectedFolder.id ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Unlink?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleUnlink(selectedFolder.id)}
                >
                  Yes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUnlinkConfirmId(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUnlinkConfirmId(selectedFolder.id)}
                aria-label="Unlink folder"
              >
                <Unlink className="h-4 w-4" />
              </Button>
            ))}
          <Button variant="ghost" size="sm" asChild>
            <a href="/settings" aria-label="Go to settings">
              <Settings className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Error */}
      {filesError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {filesError}{" "}
          <button className="underline" onClick={() => fetchFiles()}>
            Retry
          </button>
        </div>
      )}

      {/* File table */}
      {isLoadingFiles && files.length === 0 ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : sortedFiles.length === 0 && !isLoadingFiles ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          No files in this folder.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIcon field="name" />
                </TableHead>
                <TableHead>Size</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("modified")}
                >
                  Modified <SortIcon field="modified" />
                </TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFiles.map((file) => {
                const Icon = getFileIcon(file.mimeType);
                return (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {file.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFileSize(file.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatModified(file.modifiedTime)}
                    </TableCell>
                    <TableCell>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${file.name} in Drive`}
                        >
                          <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load more */}
      {nextPageToken && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchFiles(nextPageToken)}
            disabled={isLoadingFiles}
          >
            {isLoadingFiles ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Load More
          </Button>
        </div>
      )}

      <DriveFolderPicker
        crmCustomerId={crmCustomerId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onFolderLinked={loadFolders}
      />
    </div>
  );
}
