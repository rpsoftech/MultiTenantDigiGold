'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import styles from './Toast.module.scss';
import { cn } from '@/lib/utils/cn';

export type ToastVariant = 'default' | 'success' | 'danger';

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ShowToastInput = Omit<ToastItem, 'id'>;

type ToastContextValue = {
  showToast: (toast: ShowToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((toast: ShowToastInput) => {
    setToasts((current) => [...current, { ...toast, id: nextToastId++ }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            className={cn(styles.root, styles[toast.variant])}
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id);
            }}
          >
            <RadixToast.Title className={styles.title}>{toast.title}</RadixToast.Title>
            {toast.description && (
              <RadixToast.Description className={styles.description}>
                {toast.description}
              </RadixToast.Description>
            )}
            <RadixToast.Close className={styles.close} aria-label="Dismiss">
              ×
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
