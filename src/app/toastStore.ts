import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  variant: 'error' | 'success';
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant?: Toast['variant']) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, variant = 'error') =>
    set((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), message, variant }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
