import { ReactNode, useEffect } from 'react';
import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string;
  plan: 'free' | 'pro' | 'coach';
  createdAt: string;
  quotaUsed: number;
  quotaTotal: number;
  quotaResetTime: string;
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  dailyHireUsed: number;
  dailyHireCap: number;
  dailyHireResetTime: string;
  phone?: string;
  currentCity?: string;
  addressLine?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  resumeFileName?: string;
  onboardingCompleted?: boolean;
  impersonatedBy?: { id: string; email: string; name?: string };
}

type Role = 'user' | 'admin';

type AuthStore = {
  user: User | null;
  isBootstrapping: boolean;
  hasBootstrapped: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string, role?: Role) => Promise<void>;
  logout: () => void;
  signup: (name: string, email: string, password: string, phone: string) => Promise<void>;
  incrementQuota: () => void;
  refreshUser: () => Promise<void>;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string, role?: Role) => Promise<void>;
  logout: () => void;
  signup: (name: string, email: string, password: string, phone: string) => Promise<void>;
  incrementQuota: () => void;
  refreshUser: () => Promise<void>;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
};

const SESSION_KEY = 'user';

function routeRequiresAuthBootstrap(pathname: string) {
  if (!pathname) return false;
  if (pathname.startsWith('/dashboard')) return true;
  if (pathname === '/admin/login') return false;
  if (pathname.startsWith('/admin')) return true;
  return false;
}

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: User | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

async function fetchCurrentUser() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (res.status === 401 || res.status === 403) {
    return { user: null, unauthorized: true } as const;
  }
  if (!res.ok) {
    return { user: null, unauthorized: false } as const;
  }
  const data = await res.json();
  return {
    user: ((data?.data?.user || data?.user) as User | undefined) || null,
    unauthorized: false,
  } as const;
}

const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isBootstrapping: true,
  hasBootstrapped: false,

  bootstrap: async () => {
    if (get().hasBootstrapped) return;
    set({ hasBootstrapped: true, isBootstrapping: true });

    const storedUser = readStoredUser();
    if (storedUser) {
      set({ user: storedUser });
    }

    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    if (!routeRequiresAuthBootstrap(pathname) && !storedUser) {
      set({ isBootstrapping: false });
      return;
    }

    try {
      const result = await fetchCurrentUser();
      if (result.user) {
        set({ user: result.user });
        writeStoredUser(result.user);
      } else if (result.unauthorized) {
        set({ user: null });
        writeStoredUser(null);
      }
    } catch {
      // Keep local session fallback when API is unreachable.
    } finally {
      set({ isBootstrapping: false });
    }
  },

  login: async (email: string, password: string, role: Role = 'user') => {
    const currentUser = get().user;
    if (currentUser && currentUser.role !== role) {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      set({ user: null });
      writeStoredUser(null);
    }

    const endpoint = role === 'admin' ? '/api/auth/admin/login' : '/api/auth/login';
    const payload = role === 'admin' ? { email, password } : { email, password, role };
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Invalid email or password');
    }
    const sessionUser = (data?.data?.user || data?.user) as User;
    set({ user: sessionUser });
    writeStoredUser(sessionUser);
  },

  signup: async (name: string, email: string, password: string, phone: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to create account');
    }
    const sessionUser = (data?.data?.user || data?.user) as User;
    set({ user: sessionUser });
    writeStoredUser(sessionUser);
  },

  logout: () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    set({ user: null });
    writeStoredUser(null);
  },

  incrementQuota: () => {
    const user = get().user;
    if (!user) return;
    if (user.dailyHireUsed >= user.dailyHireCap) return;
    if (user.hireBalance <= 0) return;

    const updatedUser: User = {
      ...user,
      quotaUsed: user.quotaUsed + 1,
      dailyHireUsed: user.dailyHireUsed + 1,
      hireBalance: Math.max(0, user.hireBalance - 1),
      hireSpent: user.hireSpent + 1,
    };
    set({ user: updatedUser });
    writeStoredUser(updatedUser);
  },

  startImpersonation: async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data?.success) throw new Error(data?.message || 'Failed to impersonate user');
    const sessionUser = data.data.user as User;
    set({ user: sessionUser });
    writeStoredUser(sessionUser);
  },

  stopImpersonation: async () => {
    const res = await fetch('/api/auth/impersonation/stop', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      // Admin session is gone; drop the user session too so nobody stays stuck as the user.
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      set({ user: null });
      writeStoredUser(null);
      throw new Error(data?.message || 'Failed to return to admin');
    }
    const sessionUser = data.data.user as User;
    set({ user: sessionUser });
    writeStoredUser(sessionUser);
  },

  refreshUser: async () => {
    const result = await fetchCurrentUser();
    if (result.user) {
      set({ user: result.user });
      writeStoredUser(result.user);
      return;
    }
    if (result.unauthorized) {
      set({ user: null });
      writeStoredUser(null);
    }
  },
}));

export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <>{children}</>;
}

export function useAuth(): AuthContextType {
  const user = useAuthStore((state) => state.user);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const signup = useAuthStore((state) => state.signup);
  const incrementQuota = useAuthStore((state) => state.incrementQuota);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const startImpersonation = useAuthStore((state) => state.startImpersonation);
  const stopImpersonation = useAuthStore((state) => state.stopImpersonation);

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isBootstrapping,
    login,
    logout,
    signup,
    incrementQuota,
    refreshUser,
    startImpersonation,
    stopImpersonation,
  };
}
