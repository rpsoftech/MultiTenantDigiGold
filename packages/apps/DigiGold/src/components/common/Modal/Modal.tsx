'use client';

import type { CSSProperties, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useVisualViewportHeight } from '@/hooks/useVisualViewportHeight';
import styles from './Modal.module.scss';
import { cn } from '@/lib/utils/cn';

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  // 'lg' is for dialogs that hold a whole form or flow, such as buying gold.
  size?: 'md' | 'lg';
  children: ReactNode;
};

// Centered dialog on desktop, bottom sheet on mobile — same API, presentation swaps via
// the shared useMediaQuery breakpoint hook.
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
}: ModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  // Only the bottom sheet sits against the keyboard, so only it tracks the visible height.
  const visibleHeight = useVisualViewportHeight(open && !isDesktop);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          style={
            visibleHeight
              ? ({ '--modal-visible-height': `${visibleHeight}px` } as CSSProperties)
              : undefined
          }
          className={cn(
            styles.content,
            isDesktop ? styles.centered : styles.bottomSheet,
            isDesktop && size === 'lg' && styles.large
          )}
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
