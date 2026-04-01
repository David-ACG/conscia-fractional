import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";

export const metadata = {
  title: "Timer | FractionalBuddy",
};

export default function TimerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      {children}
      <Toaster richColors position="bottom-center" />
    </ThemeProvider>
  );
}
