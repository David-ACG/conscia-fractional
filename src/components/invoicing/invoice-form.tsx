"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  invoiceUpdateSchema,
  type InvoiceUpdateData,
} from "@/lib/validations/invoices";
import { updateInvoice, deleteInvoice } from "@/lib/actions/invoices";
import type { Invoice } from "@/lib/types";

interface InvoiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

export function InvoiceForm({ open, onOpenChange, invoice }: InvoiceFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const form = useForm<InvoiceUpdateData>({
    resolver: zodResolver(invoiceUpdateSchema),
    defaultValues: {
      invoice_number: invoice?.invoice_number ?? "",
      status: invoice?.status ?? "draft",
      paid_on: invoice?.paid_on ?? null,
      is_client_visible: invoice?.is_client_visible ?? false,
    },
  });

  const watchStatus = form.watch("status");

  React.useEffect(() => {
    if (open && invoice) {
      form.reset({
        invoice_number: invoice.invoice_number ?? "",
        status: invoice.status ?? "draft",
        paid_on: invoice.paid_on ?? null,
        is_client_visible: invoice.is_client_visible ?? false,
      });
    }
  }, [open, invoice, form]);

  async function onSubmit(data: InvoiceUpdateData) {
    if (!invoice) return;
    setLoading(true);
    const result = await updateInvoice(invoice.id, data);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice updated");
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!invoice) return;
    setDeleting(true);
    const result = await deleteInvoice(invoice.id);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice deleted");
    setDeleteOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription>
              Update invoice details. Period and amounts are calculated
              automatically.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="viewed">Viewed</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchStatus === "paid" && (
                <FormField
                  control={form.control}
                  name="paid_on"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid On</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="is_client_visible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Visible to client</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving…" : "Save"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              This will permanently delete invoice{" "}
              {invoice?.invoice_number ?? "this invoice"}. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
