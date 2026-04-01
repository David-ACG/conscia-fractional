"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClient } from "@/lib/client-context";
import { useSidebar } from "@/hooks/use-sidebar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AddClientDialog } from "./add-client-dialog";

export function ClientSwitcher() {
  const { clientId, setClientId, clients, isLoading } = useClient();
  const { isOpen: sidebarOpen } = useSidebar();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeClient = clients.find((c) => c.id === clientId);

  if (isLoading) {
    return (
      <div className="px-2 py-2">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (!sidebarOpen) {
    return (
      <div className="flex justify-center px-2 py-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              title={activeClient?.name ?? "Select client"}
            >
              <Avatar className="size-8">
                <AvatarFallback className="text-xs font-semibold">
                  {activeClient?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start" side="right">
            <ClientList
              clients={clients}
              clientId={clientId}
              onSelect={(id) => {
                setClientId(id);
                setOpen(false);
              }}
              onAddClient={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
            />
          </PopoverContent>
        </Popover>
        <AddClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    );
  }

  return (
    <div className="px-2 py-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between text-left font-normal"
          >
            <div className="flex items-center gap-2 truncate">
              <Avatar className="size-6">
                <AvatarFallback className="text-xs font-semibold">
                  {activeClient?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="truncate">
                <span className="font-semibold">
                  {activeClient?.name ?? "Select client"}
                </span>
                {activeClient?.industry && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {activeClient.industry}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className="ml-1 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <ClientList
            clients={clients}
            clientId={clientId}
            onSelect={(id) => {
              setClientId(id);
              setOpen(false);
            }}
            onAddClient={() => {
              setOpen(false);
              setDialogOpen(true);
            }}
          />
        </PopoverContent>
      </Popover>
      <AddClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function ClientList({
  clients,
  clientId,
  onSelect,
  onAddClient,
}: {
  clients: Array<{
    id: string;
    name: string;
    slug: string;
    industry: string | null;
  }>;
  clientId: string | null;
  onSelect: (id: string) => void;
  onAddClient: () => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="Search clients..." />
      <CommandList>
        <CommandEmpty>No clients found.</CommandEmpty>
        <CommandGroup>
          {clients.map((client) => (
            <CommandItem
              key={client.id}
              value={client.name}
              onSelect={() => onSelect(client.id)}
            >
              <Avatar className="mr-2 size-6">
                <AvatarFallback className="text-xs">
                  {client.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{client.name}</span>
              {client.industry && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {client.industry}
                </span>
              )}
              <Check
                className={cn(
                  "ml-2 size-4",
                  clientId === client.id ? "opacity-100" : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          <CommandItem onSelect={onAddClient}>
            <Plus className="mr-2 size-4" />
            Add Client
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
