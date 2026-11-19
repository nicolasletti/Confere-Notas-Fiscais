import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, type AuthState } from "@workspace/replit-auth-web";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [cacheOwner, setCacheOwner] = useState<string | null | undefined>(undefined);
  const userId = auth.user?.id ?? null;
  const preparingAccount = auth.isLoading || cacheOwner !== userId;

  useEffect(() => {
    if (auth.isLoading) return;
    if (cacheOwner !== userId) {
      // Prepare the account cache BEFORE mounting protected query observers.
      // Clearing it after those requests start cancels them and can strand their loading state.
      queryClient.clear();
      setCacheOwner(userId);
    }
  }, [auth.isLoading, cacheOwner, userId, queryClient]);

  return (
    <AuthContext.Provider value={{
      ...auth, isLoading: preparingAccount, isAuthenticated: !preparingAccount && auth.isAuthenticated,
    }}>
      <Fragment key={cacheOwner === undefined ? "initial" : cacheOwner === null ? "anonymous" : `user:${cacheOwner}`}>
        {children}
      </Fragment>
    </AuthContext.Provider>
  );
}

export function useAppAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAppAuth precisa ser usado dentro de AuthProvider.");
  }
  return context;
}
