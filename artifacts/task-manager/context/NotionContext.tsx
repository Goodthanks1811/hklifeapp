import React, { createContext, useCallback, useContext, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface NotionTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  description?: string;
  url?: string;
  tags?: string[];
  assignee?: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
  statuses: string[];
}

interface NotionContextType {
  apiKey: string | null;
  databaseId: string | null;
  tasks: NotionTask[];
  databases: NotionDatabase[];
  isLoading: boolean;
  error: string | null;
  isConfigured: boolean;
  setApiKey: (key: string) => Promise<void>;
  setDatabaseId: (id: string) => Promise<void>;
  fetchDatabases: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  updateTaskStatus: (taskId: string, newStatus: string) => Promise<void>;
  clearConfig: () => Promise<void>;
}

const NotionContext = createContext<NotionContextType | null>(null);

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export function NotionProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [databaseId, setDatabaseIdState] = useState<string | null>(null);
  const [tasks, setTasks] = useState<NotionTask[]>([]);
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = !!(apiKey && databaseId);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [savedKey, savedDbId] = await Promise.all([
          AsyncStorage.getItem("notion_api_key"),
          AsyncStorage.getItem("notion_database_id"),
        ]);
        if (savedKey) setApiKeyState(savedKey);
        if (savedDbId) setDatabaseIdState(savedDbId);
      } catch {}
    };
    load();
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    await AsyncStorage.setItem("notion_api_key", key);
    setApiKeyState(key);
  }, []);

  const setDatabaseId = useCallback(async (id: string) => {
    await AsyncStorage.setItem("notion_database_id", id);
    setDatabaseIdState(id);
  }, []);

  const clearConfig = useCallback(async () => {
    await AsyncStorage.multiRemove(["notion_api_key", "notion_database_id"]);
    setApiKeyState(null);
    setDatabaseIdState(null);
    setTasks([]);
    setDatabases([]);
  }, []);

  const fetchDatabases = useCallback(async () => {
    if (!apiKey) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/notion/databases`, {
        headers: { "x-notion-key": apiKey },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch databases");
      }
      const data = await res.json();
      setDatabases(data.databases || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  const fetchTasks = useCallback(async () => {
    if (!apiKey || !databaseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${BASE_URL}/api/notion/tasks?database_id=${databaseId}`,
        { headers: { "x-notion-key": apiKey } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch tasks");
      }
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, databaseId]);

  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: string) => {
      if (!apiKey) return;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      try {
        const res = await fetch(`${BASE_URL}/api/notion/tasks/${taskId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-notion-key": apiKey,
          },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          throw new Error("Failed to update task");
        }
      } catch (e: any) {
        setError(e.message);
        await fetchTasks();
      }
    },
    [apiKey, fetchTasks]
  );

  return (
    <NotionContext.Provider
      value={{
        apiKey,
        databaseId,
        tasks,
        databases,
        isLoading,
        error,
        isConfigured,
        setApiKey,
        setDatabaseId,
        fetchDatabases,
        fetchTasks,
        updateTaskStatus,
        clearConfig,
      }}
    >
      {children}
    </NotionContext.Provider>
  );
}

export function useNotion() {
  const ctx = useContext(NotionContext);
  if (!ctx) throw new Error("useNotion must be used inside NotionProvider");
  return ctx;
}
