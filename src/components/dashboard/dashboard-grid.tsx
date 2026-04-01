"use client";

import * as motion from "motion/react-client";
import { STAGGER_DELAY } from "@/lib/config";

interface DashboardGridProps {
  children: React.ReactNode;
}

export function DashboardGrid({ children }: DashboardGridProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: STAGGER_DELAY,
          },
        },
      }}
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {children}
    </motion.div>
  );
}

export function DashboardCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
