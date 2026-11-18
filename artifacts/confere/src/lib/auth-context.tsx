import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, type AuthState } from "@workspace/replit-auth-web";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (
      previousUserId.current !== undefined &&
      previousUserId.current !== auth.user?.id
    ) {
      queryClient.clear();
    }
    previousUserId.current = auth.user?.id ?? null;
  }, [auth.user?.id, queryClient]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAppAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAppAuth precisa ser usado dentro de AuthProvider.");
  }
  return context;
}
