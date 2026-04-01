"use client";

import * as React from "react";
import { Folder, ChevronRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
import { getGoogleIntegrations } from "@/lib/actions/integrations";

// --- Types ---

type GoogleIntegration = {
  id: string;
  account_identifier: string;
  provider: string;
};

type DriveFolder = {
  id: string;
  name: string;
};

type BreadcrumbEntry = {
  id: string | null; // null = root
  name: string;
};

// --- Props ---

interface DriveFolderPickerProps {
  crmCustomerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFolderLinked: () => void;
}

// --- Component ---

export function DriveFolderPicker({
  crmCustomerId,
  open,
  onOpenChange,
  onFolderLinked,
}: DriveFolderPickerProps) {
  const [integrations, setIntegrations] = React.useState<GoogleIntegration[]>(
    [],
  );
  const [selectedIntegrationId, setSelectedIntegrationId] =
    React.useState<string>("");
  const [folders, setFolders] = React.useState<DriveFolder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = React.useState<BreadcrumbEntry[]>([
    { id: null, name: "My Drive" },
  ]);
  const [isLoadingIntegrations, setIsLoadingIntegrations] =
    React.useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(false);
  const [isLinking, setIsLinking] = React.useState(false);
  const [foldersError, setFoldersError] = React.useState<string | null>(null);
  const [linkError, setLinkError] = React.useState<string | null>(null);

  // Load integrations when dialog opens
  React.useEffect(() => {
    if (!open) return;
    setIsLoadingIntegrations(true);
    getGoogleIntegrations()
      .then((data) => {
        setIntegrations(data);
        if (data.length > 0) {
          setSelectedIntegrationId(data[0].id);
        }
      })
      .catch(() => {
        setIntegrations([]);
      })
      .finally(() => {
        setIsLoadingIntegrations(false);
      });
  }, [open]);

  // Load folders when integration or current folder changes
  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  const loadFolders = React.useCallback(
    async (integrationId: string, parentId: string | null) => {
      if (!integrationId) return;
      setIsLoadingFolders(true);
      setFoldersError(null);
      try {
        const params = new URLSearchParams({ integration_id: integrationId });
        if (parentId) params.set("parent_id", parentId);
        const res = await fetch(
          `/api/integrations/google/drive/folders?${params.toString()}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to load folders");
        }
        const data = await res.json();
        setFolders(data.folders ?? []);
      } catch (err) {
        setFoldersError(
          err instanceof Error ? err.message : "Could not load folders.",
        );
        setFolders([]);
      } finally {
        setIsLoadingFolders(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!open || !selectedIntegrationId) return;
    loadFolders(selectedIntegrationId, currentFolder.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedIntegrationId, currentFolder.id]);

  const handleFolderClick = (folder: DriveFolder) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleSelectFolder = async () => {
    setIsLinking(true);
    setLinkError(null);
    try {
      const res = await fetch("/api/integrations/google/drive/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crm_customer_id: crmCustomerId,
          integration_id: selectedIntegrationId,
          folder_id: currentFolder.id ?? "root",
          folder_name: currentFolder.name,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to link folder");
      }
      onOpenChange(false);
      onFolderLinked();
      // Reset state for next open
      setBreadcrumbs([{ id: null, name: "My Drive" }]);
      setFolders([]);
    } catch (err) {
      setLinkError(
        err instanceof Error ? err.message : "Failed to link folder",
      );
    } finally {
      setIsLinking(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setBreadcrumbs([{ id: null, name: "My Drive" }]);
    setFolders([]);
    setFoldersError(null);
    setLinkError(null);
  };

  const handleIntegrationChange = (id: string) => {
    setSelectedIntegrationId(id);
    setBreadcrumbs([{ id: null, name: "My Drive" }]);
    setFolders([]);
  };

  // Current folder display name for the Select button
  const currentFolderName = currentFolder.name;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Google Drive Folder</DialogTitle>
        </DialogHeader>

        {isLoadingIntegrations ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : integrations.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No Google accounts connected.{" "}
            <a
              href="/dashboard/settings"
              className="underline hover:text-foreground"
              onClick={handleClose}
            >
              Connect one in Settings
            </a>
            .
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account selector */}
            {integrations.length > 1 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Account
                </label>
                <Select
                  value={selectedIntegrationId}
                  onValueChange={handleIntegrationChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {integrations.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.account_identifier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {integrations.length === 1 && (
              <p className="text-sm text-muted-foreground">
                Account: {integrations[0].account_identifier}
              </p>
            )}

            {/* Breadcrumb */}
            <nav
              className="flex items-center gap-1 text-sm flex-wrap"
              aria-label="Folder navigation"
            >
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <button
                    className={
                      index === breadcrumbs.length - 1
                        ? "font-medium"
                        : "text-muted-foreground hover:text-foreground hover:underline"
                    }
                    onClick={() => handleBreadcrumbClick(index)}
                    disabled={index === breadcrumbs.length - 1}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </nav>

            {/* Folder list */}
            {isLoadingFolders ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : foldersError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <span>{foldersError}</span>{" "}
                <button
                  className="underline"
                  onClick={() =>
                    loadFolders(selectedIntegrationId, currentFolder.id)
                  }
                >
                  Retry
                </button>
              </div>
            ) : folders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                This folder has no subfolders.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto rounded-md border divide-y">
                {folders.map((folder) => (
                  <li key={folder.id}>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {folder.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Link error */}
            {linkError && (
              <p className="text-sm text-destructive">{linkError}</p>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSelectFolder}
                disabled={isLinking || !selectedIntegrationId}
              >
                {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {`Select "${currentFolderName}"`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
