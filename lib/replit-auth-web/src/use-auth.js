import { useCallback, useEffect, useState } from "react";
function getBasePath() {
    return "/";
}
function safeReturnTo(returnTo) {
    if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
        return getBasePath();
    }
    return returnTo;
}
export function useAuth() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/user", { credentials: "include", cache: "no-store" })
            .then((response) => {
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            return response.json();
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
    const login = useCallback((returnTo) => {
        const destination = safeReturnTo(returnTo);
        window.location.href = `/api/login?returnTo=${encodeURIComponent(destination)}`;
    }, []);
    const signup = useCallback((returnTo) => {
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
