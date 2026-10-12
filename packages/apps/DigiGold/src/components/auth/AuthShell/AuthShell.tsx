import type { ReactNode } from 'react';
import { Header } from '@/components/common/Header/Header';
import { Footer } from '@/components/common/Footer/Footer';
import styles from './AuthShell.module.scss';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.content}>{children}</main>
      <Footer />
    </div>
  );
}
