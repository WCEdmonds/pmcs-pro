import { create } from 'zustand';
import { db } from '../utils/db';
import type { User } from '../types';

interface UserState {
  user: User | null;
  isLoading: boolean;
  login: (dodId: string) => Promise<User | null>;
  createUser: (user: User) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => void;
  loadUser: (dodId: string) => Promise<User | null>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: false,

  login: async (dodId: string) => {
    set({ isLoading: true });
    const user = await db.users.get(dodId);
    if (user) {
      set({ user, isLoading: false });
      return user;
    }
    set({ isLoading: false });
    return null;
  },

  createUser: async (user: User) => {
    await db.users.put(user);
    set({ user });
  },

  updateUser: async (updates: Partial<User>) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, ...updates };
    await db.users.put(updated);
    set({ user: updated });
  },

  setUser: (user: User) => set({ user }),

  logout: () => set({ user: null }),

  loadUser: async (dodId: string) => {
    const user = await db.users.get(dodId);
    if (user) set({ user });
    return user ?? null;
  },
}));
