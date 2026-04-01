"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useClient } from "@/lib/client-context";
import { createClientWithEngagement } from "@/lib/actions/clients";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const addClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  industry: z.string().optional().default(""),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  linkedin_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  role_title: z.string().min(1, "Role title is required"),
  day_rate_gbp: z.coerce
    .number()
    .positive()
    .optional()
    .or(z.literal(0))
    .or(z.nan()),
  hourly_rate_gbp: z.coerce
    .number()
    .positive()
    .optional()
    .or(z.literal(0))
    .or(z.nan()),
  hours_per_week: z.coerce
    .number()
    .positive()
    .optional()
    .or(z.literal(0))
    .or(z.nan()),
  billing_frequency: z.string().optional().default(""),
});

type AddClientFormData = z.infer<typeof addClientSchema>;

export function AddClientDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { setClientId, refreshClients } = useClient();

  const form = useForm<AddClientFormData>({
    resolver: zodResolver(addClientSchema) as never,
    defaultValues: {
      name: "",
      industry: "",
      website: "",
      linkedin_url: "",
      role_title: "",
      day_rate_gbp: undefined,
      hourly_rate_gbp: undefined,
      hours_per_week: undefined,
      billing_frequency: "",
    },
  });

  async function onSubmit(data: AddClientFormData) {
    const result = await createClientWithEngagement({
      name: data.name,
      industry: data.industry || undefined,
      website: data.website || undefined,
      linkedin_url: data.linkedin_url || undefined,
      role_title: data.role_title,
      day_rate_gbp:
        data.day_rate_gbp && !isNaN(data.day_rate_gbp)
          ? data.day_rate_gbp
          : undefined,
      hourly_rate_gbp:
        data.hourly_rate_gbp && !isNaN(data.hourly_rate_gbp)
          ? data.hourly_rate_gbp
          : undefined,
      hours_per_week:
        data.hours_per_week && !isNaN(data.hours_per_week)
          ? data.hours_per_week
          : undefined,
      billing_frequency: data.billing_frequency || undefined,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    await refreshClients();
    setClientId(result.clientId!);
    toast.success(`${data.name} added`);
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Client fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Technology" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
              name="linkedin_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company LinkedIn</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://www.linkedin.com/company/conscia/"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Engagement fields */}
            <p className="text-sm font-medium">First Engagement</p>
            <FormField
              control={form.control}
              name="role_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Fractional CTO" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="day_rate_gbp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day Rate (GBP)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="750" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hourly_rate_gbp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate (GBP)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="95" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="hours_per_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours / Week</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="16" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="billing_frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Frequency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding..." : "Add Client"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
