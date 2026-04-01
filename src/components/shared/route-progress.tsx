"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "./spinner";

export function RouteProgress() {
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [isNavigating, setIsNavigating] = useState(false);
  const [changeCount, setChangeCount] = useState(0);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    const nextCount = changeCount + 1;
    setChangeCount(nextCount);
    if (nextCount > 1) {
      setIsNavigating(true);
    }
  }

  useEffect(() => {
    if (!isNavigating) return;
    const id = setTimeout(() => setIsNavigating(false), 500);
    return () => clearTimeout(id);
  }, [isNavigating]);

  if (!isNavigating) return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[100] h-0.5">
        <div className="h-full animate-progress bg-gradient-to-r from-primary via-accent to-primary" />
      </div>
      <div className="fixed right-4 top-4 z-[100]">
        <Spinner size={20} />
      </div>
    </>
  );
}
