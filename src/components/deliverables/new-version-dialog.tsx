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
import {
  newVersionSchema,
  type NewVersionFormData,
} from "@/lib/validations/deliverables";
import { createNewVersion } from "@/lib/actions/deliverables";

interface NewVersionDialogProps {
  deliverableId: string;
  deliverableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewVersionDialog({
  deliverableId,
  deliverableName,
  open,
  onOpenChange,
}: NewVersionDialogProps) {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<NewVersionFormData>({
    resolver: zodResolver(newVersionSchema),
    defaultValues: {
      notes: "",
      file_url: "",
      file_name: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ notes: "", file_url: "", file_name: "" });
    }
  }, [open, form]);

  async function onSubmit(data: NewVersionFormData) {
    setLoading(true);
    const result = await createNewVersion(deliverableId, data);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("New version published");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish New Version</DialogTitle>
          <DialogDescription>
            Create a new version of &ldquo;{deliverableName}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What changed in this version?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the changes..."
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
              name="file_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New File Link (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. report-v2.pdf" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Publishing..." : "Publish Version"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
