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
import { Textarea } from "@/components/ui/textarea";
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
  crmCustomerSchema,
  type CrmCustomerFormData,
} from "@/lib/validations/crm";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/actions/crm";
import type { CrmCustomer } from "@/lib/types";

interface CrmFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: CrmCustomer | null;
}

export function CrmForm({ open, onOpenChange, customer }: CrmFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const isEdit = !!customer;

  const form = useForm<CrmCustomerFormData>({
    resolver: zodResolver(crmCustomerSchema),
    defaultValues: {
      name: customer?.name ?? "",
      website: customer?.website ?? "",
      industry: customer?.industry ?? "",
      description: customer?.description ?? "",
      status: customer?.status ?? "prospect",
      primary_contact: customer?.primary_contact ?? "",
      google_drive_url: customer?.google_drive_url ?? "",
      is_client_visible: customer?.is_client_visible ?? false,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: customer?.name ?? "",
        website: customer?.website ?? "",
        industry: customer?.industry ?? "",
        description: customer?.description ?? "",
        status: customer?.status ?? "prospect",
        primary_contact: customer?.primary_contact ?? "",
        google_drive_url: customer?.google_drive_url ?? "",
        is_client_visible: customer?.is_client_visible ?? false,
      });
    }
  }, [open, customer, form]);

  async function onSubmit(data: CrmCustomerFormData) {
    setLoading(true);
    const result = isEdit
      ? await updateCustomer(customer!.id, data)
      : await createCustomer(data);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Customer updated" : "Customer added");
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!customer) return;
    setDeleting(true);
    const result = await deleteCustomer(customer.id);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Customer deleted");
      setDeleteOpen(false);
      onOpenChange(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update customer information."
                : "Add a new CRM customer."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="google_drive_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Drive URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://drive.google.com/..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Retail, Technology"
                          {...field}
                        />
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
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="primary_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the customer"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_client_visible"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      Visible to client portal
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                {isEdit && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : isEdit ? "Update" : "Add Customer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{customer?.name}&rdquo;?
              This cannot be undone.
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
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
