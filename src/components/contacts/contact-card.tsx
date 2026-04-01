"use client";

import * as React from "react";
import {
  Mail,
  Phone,
  MessageSquare,
  ExternalLink,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteContact, toggleContactVisibility } from "@/lib/actions/contacts";
import type { Contact } from "@/lib/types";

// Consistent avatar color from name hash
function nameToColor(name: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const contactMethodConfig = {
  slack: {
    label: "Slack",
    icon: MessageSquare,
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  email: {
    label: "Email",
    icon: Mail,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  phone: {
    label: "Phone",
    icon: Phone,
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  teams: {
    label: "Teams",
    icon: Monitor,
    className:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  },
};

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
}

export function ContactCard({ contact, onEdit }: ContactCardProps) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const method = contactMethodConfig[contact.preferred_contact_method];
  const MethodIcon = method.icon;

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteContact(contact.id);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Contact deleted");
      setDeleteOpen(false);
    }
  }

  async function handleToggleVisibility() {
    const result = await toggleContactVisibility(
      contact.id,
      !contact.is_client_visible,
    );
    if (result.error) {
      toast.error(result.error);
    }
  }

  function copySlackId() {
    if (contact.slack_id) {
      navigator.clipboard.writeText(contact.slack_id);
      toast.success("Slack ID copied");
    }
  }

  return (
    <>
      <Card className="group relative transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          {/* Header: Avatar + Name + Role */}
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback
                className={`${nameToColor(contact.name)} text-white text-sm font-medium`}
              >
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold leading-tight">
                {contact.name}
              </h3>
              {contact.role && (
                <p className="truncate text-sm text-muted-foreground">
                  {contact.role}
                </p>
              )}
            </div>

            {/* Top-right actions */}
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleToggleVisibility}
                    >
                      {contact.is_client_visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {contact.is_client_visible
                      ? "Visible to client"
                      : "Hidden from client"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(contact)}
                aria-label="Edit contact"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete contact"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Preferred contact method */}
          <div className="mt-3">
            <Badge className={`gap-1 ${method.className}`} variant="secondary">
              <MethodIcon className="h-3 w-3" />
              {method.label}
            </Badge>
          </div>

          {/* Skills */}
          {contact.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {contact.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          {/* Working on */}
          {contact.working_on && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    Working on: {contact.working_on}
                  </p>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{contact.working_on}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Quick action links */}
          <div className="mt-3 flex items-center gap-1 border-t pt-2">
            {contact.email && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                    >
                      <a href={`mailto:${contact.email}`}>
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{contact.email}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {contact.phone && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                    >
                      <a href={`tel:${contact.phone}`}>
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{contact.phone}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {contact.slack_id && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={copySlackId}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="flex items-center gap-1">
                    {contact.slack_id} <Copy className="h-3 w-3" />
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {contact.linkedin_url && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                    >
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>LinkedIn</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {contact.name}? This cannot be
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
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
