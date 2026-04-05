import { InboxIcon } from "lucide-react";

interface PortalEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export function PortalEmptyState({
  icon,
  title,
  description,
}: PortalEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <div className="text-muted-foreground">
        {icon ?? <InboxIcon className="size-10" />}
      </div>
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
