'use client';

import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import styles from './Modal.module.scss';
import { cn } from '@/lib/utils/cn';

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
};

// Centered dialog on desktop, bottom sheet on mobile — same API, presentation swaps via
// the shared useMediaQuery breakpoint hook.
export function Modal({ open, onOpenChange, title, description, children }: ModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={cn(styles.content, isDesktop ? styles.centered : styles.bottomSheet)}
        >
          {title && <Dialog.Title className={styles.title}>{title}</Dialog.Title>}
          {description && (
            <Dialog.Description className={styles.description}>{description}</Dialog.Description>
          )}
          {children}
          <Dialog.Close className={styles.close} aria-label="Close">
            ×
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
