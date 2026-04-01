"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface InvoicePreviewProps {
  text: string;
  totalDays: number;
  totalAmount: number;
  dayRate: number;
}

export function InvoicePreview({
  text,
  totalDays,
  totalAmount,
  dayRate,
}: InvoicePreviewProps) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Invoice text copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <Card className="bg-muted p-4">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
          {text}
        </pre>
      </Card>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy to Clipboard"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {parseFloat(totalDays.toFixed(3))} days @ £{dayRate.toFixed(2)} = £
          {totalAmount.toLocaleString("en-GB", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  );
}
