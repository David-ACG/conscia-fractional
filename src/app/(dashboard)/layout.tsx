import { Sidebar } from "@/components/layout/sidebar";
import { DashboardHeader } from "@/components/layout/header";
import { TimerProvider } from "@/components/timer/timer-provider";
import { TimerWidget } from "@/components/timer/timer-widget";
import { ClientProvider } from "@/lib/client-context";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userName: string | null = null;
  let userEmail: string | null = null;
  let userAvatarUrl: string | null = null;

  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userName =
        user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
      userEmail = user.email ?? null;
      userAvatarUrl =
        user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;
    }
  }

  return (
    <ClientProvider>
      <TimerProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <DashboardHeader
              userName={userName}
              userEmail={userEmail}
              userAvatarUrl={userAvatarUrl}
            />
            <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
              <div className="mx-auto max-w-[1400px]">{children}</div>
            </main>
          </div>
        </div>
        <TimerWidget />
      </TimerProvider>
    </ClientProvider>
  );
}
