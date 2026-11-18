import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (returnTo?: string) => void;
  signup: (returnTo?: string) => void;
  logout: () => void;
}

function getBasePath() {
  return "/";
}

function safeReturnTo(returnTo?: string) {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return getBasePath();
  }
  return returnTo;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ user: AuthUser | null }>;
      })
      .then(({ user: currentUser }) => {
        if (!cancelled) {
          setUser(currentUser ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((returnTo?: string) => {
    const destination = safeReturnTo(returnTo);
    window.location.href = `/api/login?returnTo=${encodeURIComponent(destination)}`;
  }, []);

  const signup = useCallback((returnTo?: string) => {
    login(returnTo);
  }, [login]);

  const logout = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(base)}`;
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
  };
}
