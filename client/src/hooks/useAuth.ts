import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, setSessionToken, getSessionToken, getAuthHeaders } from "@/lib/queryClient";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  organizationId: number;
}

interface AuthOrg {
  id: number;
  name: string;
  slug: string;
  plan: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

interface AuthData {
  user: AuthUser;
  organization: AuthOrg | null;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AuthData>({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.sessionId) setSessionToken(data.sessionId);
      queryClient.setQueryData(["auth"], { user: data.user, organization: data.organization });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; name: string; venueName: string; plan?: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.sessionId) setSessionToken(data.sessionId);
      queryClient.setQueryData(["auth"], { user: data.user, organization: data.organization });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      setSessionToken(null);
      queryClient.setQueryData(["auth"], null);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      window.location.href = "/";
    },
  });

  return {
    user: data?.user ?? null,
    organization: data?.organization ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    login: loginMutation,
    register: registerMutation,
    logout: logoutMutation,
  };
}
