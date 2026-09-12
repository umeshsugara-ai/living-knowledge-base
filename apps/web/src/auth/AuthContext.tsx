/**
 * apps/web/src/auth/AuthContext.tsx — React-ified version of the fast pages' own mechanism
 * (paste an API key once, store in localStorage, attach as `Authorization: Bearer <key>` on
 * every fetch). Not a new auth model, a new UI for the same real one apps/api already enforces.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AUTH_INVALIDATED_EVENT, AUTH_KEY_STORAGE_KEY, type AuthInvalidationEventDetail } from "../api/client.js";

export interface AuthContextValue {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [apiKey, setApiKeyState] = useState<string | null>(() => localStorage.getItem(AUTH_KEY_STORAGE_KEY));

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem(AUTH_KEY_STORAGE_KEY, key);
    setApiKeyState(key);
  }, []);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(AUTH_KEY_STORAGE_KEY);
    setApiKeyState(null);
  }, []);

  const handleAuthInvalidated = useCallback((event: Event) => {
    const detail = (event as CustomEvent<AuthInvalidationEventDetail>).detail;
    const storageKey = localStorage.getItem(AUTH_KEY_STORAGE_KEY);
    if (!detail) return;
    if (detail.apiKey !== apiKey && detail.apiKey !== storageKey && storageKey !== null) return;
    clearApiKey();
  }, [apiKey, clearApiKey]);

  useEffect(() => {
    window.addEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    return () => {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    };
  }, [handleAuthInvalidated]);

  const value = useMemo(() => ({ apiKey, setApiKey, clearApiKey }), [apiKey, setApiKey, clearApiKey]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
