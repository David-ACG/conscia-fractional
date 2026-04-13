"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
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
  meetingSchema,
  type MeetingFormData,
} from "@/lib/validations/meetings";
import { createMeeting, updateMeeting } from "@/lib/actions/meetings";
import { linkMeetingToEventAction } from "@/lib/actions/calendar";
import type { Meeting, CrmCustomer, MeetingPreFillData } from "@/lib/types";

interface MeetingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting?: Meeting | null;
  customers: Pick<CrmCustomer, "id" | "name">[];
  /** Pre-fill values from a calendar event */
  prefillData?: MeetingPreFillData | null;
  /** Called when the user clears the pre-fill banner */
  onClear?: () => void;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingForm({
  open,
  onOpenChange,
  meeting,
  customers,
  prefillData,
  onClear,
}: MeetingFormProps) {
  const [loading, setLoading] = React.useState(false);
  const isEdit = !!meeting;
  const isPrefilled = Boolean(prefillData && !meeting);

  const form = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: "",
      meeting_date: "",
      duration_minutes: undefined,
      crm_customer_id: "",
      attendees: [],
      summary: "",
      transcript: "",
      recording_url: "",
      platform: undefined,
      is_client_visible: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attendees",
  });

  React.useEffect(() => {
    if (open) {
      if (prefillData && !meeting) {
        // Pre-fill from calendar event
        form.reset({
          title: prefillData.title,
          meeting_date: toDatetimeLocal(prefillData.date),
          duration_minutes: prefillData.duration,
          crm_customer_id: prefillData.crm_customer_id ?? "",
          attendees: prefillData.participants.map((p) => ({
            name: p.name,
            email: p.email,
            role: "",
          })),
          summary: "",
          transcript: "",
          recording_url: "",
          platform: undefined,
          is_client_visible: false,
        });
      } else {
        form.reset({
          title: meeting?.title ?? "",
          meeting_date: meeting?.meeting_date
            ? toDatetimeLocal(meeting.meeting_date)
            : "",
          duration_minutes: meeting?.duration_minutes ?? undefined,
          crm_customer_id: meeting?.crm_customer_id ?? "",
          attendees: meeting?.attendees ?? [],
          summary: meeting?.summary ?? "",
          transcript: meeting?.transcript ?? "",
          recording_url: meeting?.recording_url ?? "",
          platform: meeting?.platform ?? undefined,
          is_client_visible: meeting?.is_client_visible ?? false,
        });
      }
    }
  }, [open, meeting, prefillData, form]);

  async function onSubmit(data: MeetingFormData) {
    setLoading(true);
    // Convert datetime-local to ISO
    const submitData = {
      ...data,
      meeting_date: data.meeting_date
        ? new Date(data.meeting_date).toISOString()
        : "",
    };
    const result = isEdit
      ? await updateMeeting(meeting!.id, submitData)
      : await createMeeting(submitData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    // Link the new meeting back to its calendar event if pre-filled
    if (
      !isEdit &&
      prefillData?.source_event_id &&
      "meetingId" in result &&
      result.meetingId
    ) {
      await linkMeetingToEventAction(
        result.meetingId,
        prefillData.source_event_id,
      );
    }

    toast.success(isEdit ? "Meeting updated" : "Meeting created");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Meeting" : "Add Meeting"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update meeting details."
              : "Log a new meeting with notes and attendees."}
          </DialogDescription>
        </DialogHeader>

        {isPrefilled && (
          <div
            className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-950/30"
            data-testid="prefill-banner"
          >
            <span className="text-blue-800 dark:text-blue-200">
              Pre-filled from calendar event:{" "}
              <strong>{prefillData!.title}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2 h-7 px-2 text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
              onClick={onClear}
              data-testid="prefill-clear-btn"
            >
              Clear
            </Button>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Meeting title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="meeting_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date & Time *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 60"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select
                      onValueChange={(v) =>
                        field.onChange(v === "__none" ? undefined : v)
                      }
                      value={field.value ?? "__none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none">Other</SelectItem>
                        <SelectItem value="zoom">Zoom</SelectItem>
                        <SelectItem value="teams">Teams</SelectItem>
                        <SelectItem value="meet">Google Meet</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="crm_customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      onValueChange={(v) =>
                        field.onChange(v === "__none__" ? null : v)
                      }
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None / Admin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None / Admin</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Attendees */}
            <div>
              <Label>Attendees</Label>
              <div className="mt-2 space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <FormField
                      control={form.control}
                      name={`attendees.${index}.name`}
                      render={({ field: f }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Name" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`attendees.${index}.email`}
                      render={({ field: f }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              placeholder="Email"
                              type="email"
                              {...f}
                              value={f.value ?? ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`attendees.${index}.role`}
                      render={({ field: f }) => (
                        <FormItem className="w-[120px]">
                          <FormControl>
                            <Input
                              placeholder="Role"
                              {...f}
                              value={f.value ?? ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: "", email: "", role: "" })}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Attendee
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Meeting summary or key points"
                      className="resize-none"
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transcript"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transcript</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste transcript or meeting notes (markdown supported)"
                      className="resize-none"
                      rows={10}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recording_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recording URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update" : "Add Meeting"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
