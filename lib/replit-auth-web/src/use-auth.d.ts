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
export declare function useAuth(): AuthState;
//# sourceMappingURL=use-auth.d.ts.map