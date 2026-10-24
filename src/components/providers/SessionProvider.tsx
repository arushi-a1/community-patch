"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/components/lib/api";

interface SessionUser {
  id: string;
  displayName: string;
}
interface SessionState {
  actorId: string | null;
  devMode: boolean;
  users: SessionUser[];
  loading: boolean;
  refresh: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [actorId, setActorId] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await api.session();
      setActorId(s.actor.userId);
      setDevMode(s.devMode);
      setUsers(s.users);
    } catch {
      // keep prior state; session endpoint failure is non-fatal for browsing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchUser = useCallback(
    async (userId: string) => {
      await api.switchUser(userId);
      await refresh();
    },
    [refresh],
  );

  return (
    <SessionContext.Provider value={{ actorId, devMode, users, loading, refresh, switchUser }}>
      {children}
    </SessionContext.Provider>
  );
}
