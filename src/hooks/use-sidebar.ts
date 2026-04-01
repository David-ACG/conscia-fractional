"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { MOBILE_BREAKPOINT } from "@/lib/config";

const STORAGE_KEY = "fb-sidebar-open";

let sidebarOpen = true;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function subscribeSidebar(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSidebarSnapshot(): boolean {
  return sidebarOpen;
}

function getServerSidebarSnapshot(): boolean {
  return true;
}

if (typeof window !== "undefined") {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    sidebarOpen = stored === "true";
  }
  if (window.innerWidth < MOBILE_BREAKPOINT) {
    sidebarOpen = false;
  }
}

function subscribeMobile(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler);
}

function getMobileSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerMobileSnapshot(): boolean {
  return false;
}

export function useSidebar() {
  const isOpen = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getServerSidebarSnapshot,
  );

  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getServerMobileSnapshot,
  );

  useEffect(() => {
    if (isMobile && sidebarOpen) {
      sidebarOpen = false;
      notifyListeners();
    }
  }, [isMobile]);

  const toggle = useCallback(() => {
    sidebarOpen = !sidebarOpen;
    localStorage.setItem(STORAGE_KEY, String(sidebarOpen));
    notifyListeners();
  }, []);

  const open = useCallback(() => {
    sidebarOpen = true;
    localStorage.setItem(STORAGE_KEY, "true");
    notifyListeners();
  }, []);

  const close = useCallback(() => {
    sidebarOpen = false;
    localStorage.setItem(STORAGE_KEY, "false");
    notifyListeners();
  }, []);

  return { isOpen, isMobile, toggle, open, close };
}
