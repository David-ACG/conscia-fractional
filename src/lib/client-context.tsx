"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { setActiveClient } from "@/lib/actions/clients";

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
}

interface ClientContextValue {
  clientId: string | null;
  setClientId: (id: string) => void;
  clients: ClientInfo[];
  isLoading: boolean;
  refreshClients: () => Promise<void>;
}

const ClientContext = createContext<ClientContextValue>({
  clientId: null,
  setClientId: () => {},
  clients: [],
  isLoading: true,
  refreshClients: async () => {},
});

function getStoredClientId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("fb_client_id="));
  return match ? (match.split("=")[1] ?? null) : null;
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clientId, setClientIdState] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) return [];
      return (await res.json()) as ClientInfo[];
    } catch {
      return [];
    }
  }, []);

  // Fetch clients on mount
  useEffect(() => {
    async function init() {
      const clientList = await fetchClients();
      setClients(clientList);

      const stored = getStoredClientId();
      if (stored && clientList.some((c) => c.id === stored)) {
        setClientIdState(stored);
      } else if (clientList.length > 0) {
        const first = clientList[0]!;
        setClientIdState(first.id);
        await setActiveClient(first.id);
      }

      setIsLoading(false);
    }

    init();
  }, [fetchClients]);

  const setClientId = useCallback(async (id: string) => {
    setClientIdState(id);
    await setActiveClient(id);
  }, []);

  const refreshClients = useCallback(async () => {
    const clientList = await fetchClients();
    setClients(clientList);
  }, [fetchClients]);

  return (
    <ClientContext.Provider
      value={{
        clientId,
        setClientId: (id: string) => {
          setClientId(id);
        },
        clients,
        isLoading,
        refreshClients,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  return useContext(ClientContext);
}
