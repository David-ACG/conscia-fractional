"use client";

import * as React from "react";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  extractContractData,
  saveContractData,
  type ContractExtraction,
} from "@/lib/actions/engagement";

interface ContractUploadProps {
  engagementId: string;
  onSaved?: () => void;
}

type UploadState =
  | "idle"
  | "uploading"
  | "extracting"
  | "preview"
  | "saving"
  | "done";

export function ContractUpload({ engagementId, onSaved }: ContractUploadProps) {
  const [state, setState] = React.useState<UploadState>("idle");
  const [extraction, setExtraction] = React.useState<ContractExtraction | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported");
      return;
    }

    setFileName(file.name);
    setError(null);
    setState("extracting");

    // Read file as base64
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );

    const result = await extractContractData(base64, file.type);

    if (result.error) {
      setError(result.error);
      setState("idle");
      return;
    }

    setExtraction(result.data ?? null);
    setState("preview");
  }

  async function handleSave() {
    if (!extraction) return;
    setState("saving");
    const result = await saveContractData(engagementId, extraction);
    if (result.error) {
      setError(result.error);
      setState("preview");
    } else {
      setState("done");
      toast.success("Contract data saved");
      onSaved?.();
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  if (state === "done") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <Check className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium">Contract data saved</p>
            <p className="text-sm text-muted-foreground">
              {fileName} processed successfully
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "preview" && extraction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Review Extracted Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <PreviewRow label="Client" value={extraction.client_name} />
          <PreviewRow label="Role" value={extraction.role} />
          <PreviewRow
            label="Day rate"
            value={extraction.day_rate ? `£${extraction.day_rate}` : null}
          />
          <PreviewRow
            label="Hourly rate"
            value={extraction.hourly_rate ? `£${extraction.hourly_rate}` : null}
          />
          <PreviewRow
            label="Hours/week"
            value={extraction.hours_per_week?.toString() ?? null}
          />
          <PreviewRow label="Payment terms" value={extraction.payment_terms} />
          <PreviewRow label="Start date" value={extraction.start_date} />
          <PreviewRow label="End date" value={extraction.end_date} />
          {extraction.scope.length > 0 && (
            <div>
              <span className="text-muted-foreground">Scope:</span>
              <ul className="ml-4 mt-1 list-disc">
                {extraction.scope.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {extraction.end_clients.length > 0 && (
            <PreviewRow
              label="End clients"
              value={extraction.end_clients.join(", ")}
            />
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setState("idle");
                setExtraction(null);
              }}
            >
              Re-upload
            </Button>
            <Button size="sm" onClick={handleSave}>
              {state === "saving" ? "Saving..." : "Save & Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Upload Contract
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          {state === "extracting" ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Extracting contract data...
              </p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drop PDF here or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  Contract will be parsed by AI to extract terms
                </p>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {fileName && state === "idle" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{fileName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
