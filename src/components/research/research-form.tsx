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
import { TagInput } from "@/components/ui/tag-input";
import {
  researchSchema,
  type ResearchFormData,
} from "@/lib/validations/research";
import {
  createResearch,
  updateResearch,
  deleteResearch,
} from "@/lib/actions/research";
import type { Research } from "@/lib/types";

interface ResearchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  research?: Research | null;
  allTags?: string[];
}

export function ResearchForm({
  open,
  onOpenChange,
  research,
  allTags = [],
}: ResearchFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const isEdit = !!research;

  const form = useForm<ResearchFormData>({
    resolver: zodResolver(researchSchema),
    defaultValues: {
      title: research?.title ?? "",
      content: research?.content ?? "",
      research_type: research?.research_type ?? "architecture",
      tags: research?.tags ?? [],
      is_client_visible: research?.is_client_visible ?? false,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        title: research?.title ?? "",
        content: research?.content ?? "",
        research_type: research?.research_type ?? "architecture",
        tags: research?.tags ?? [],
        is_client_visible: research?.is_client_visible ?? false,
      });
    }
  }, [open, research, form]);

  async function onSubmit(data: ResearchFormData) {
    setLoading(true);
    const result = isEdit
      ? await updateResearch(research!.id, data)
      : await createResearch(data);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Research updated" : "Research created");
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!research) return;
    setDeleting(true);
    const result = await deleteResearch(research.id);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Research deleted");
      setDeleteOpen(false);
      onOpenChange(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Research" : "Add Research"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update research details."
                : "Create a new research item."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Research title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="research_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="architecture">
                          Architecture
                        </SelectItem>
                        <SelectItem value="competitor">Competitor</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="market">Market</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your research notes in markdown..."
                        className="resize-none"
                        rows={16}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      File attachments coming soon
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <TagInput
                        value={field.value}
                        onChange={field.onChange}
                        suggestions={allTags}
                        placeholder="Type a tag and press Enter"
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
                  {loading ? "Saving..." : isEdit ? "Update" : "Add Research"}
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
            <DialogTitle>Delete research</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{research?.title}&rdquo;?
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
