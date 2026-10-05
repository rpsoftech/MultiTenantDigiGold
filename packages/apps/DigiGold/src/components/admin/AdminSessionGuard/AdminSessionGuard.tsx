'use client';

import { useEffect, useState } from 'react';
import { useStore } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button/Button';
import { adminAuthService } from '@/features/admin-auth/admin-auth.service';
import { adminSessionUser } from '@/features/admin-auth/admin-session';
import {
  clearAdminTokens,
  getAdminAccessToken,
  getAdminRefreshToken,
  getAdminSessionId,
  getAdminTokenRevision,
} from '@/lib/api/admin-tokens';
import { ROUTES } from '@/lib/constants/routes';
import type { RootState } from '@/store';
import { useAppSelector } from '@/store/hooks';
import {
  adminSessionCleared,
  adminSessionEstablished,
  selectIsAdmin,
} from '@/store/session/session.slice';
import styles from './AdminSessionGuard.module.scss';

export function AdminSessionGuard({ children }: { children: React.ReactNode }) {
  const store = useStore<RootState>();
  const isAdmin = useAppSelector(selectIsAdmin);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'checking' | 'ready' | 'failed'>(
    'checking',
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let expired = false;
    const sessionId = getAdminSessionId();

    function expire() {
      if (!active || expired) return;
      expired = true;
      setStatus('checking');
      clearAdminTokens();
      void queryClient.cancelQueries({ queryKey: ['admin'] });
      queryClient.removeQueries({ queryKey: ['admin'] });
      store.dispatch(adminSessionCleared());
      router.replace(ROUTES.adminLogin);
    }

    function restoreStoredAccessToken(): boolean {
      const token = getAdminAccessToken();
      if (!token) return false;
      try {
        const user = adminSessionUser(token);
        store.dispatch(adminSessionEstablished(user));
        setStatus('ready');
        return true;
      } catch {
        return false;
      }
    }

    async function restore() {
      if (restoreStoredAccessToken()) return;
      if (!getAdminRefreshToken()) {
        expire();
        return;
      }

      const revision = getAdminTokenRevision();
      try {
        const tokens = await adminAuthService.refresh();
        if (!active || expired) return;

        // Refresh persists its rotated tokens. Never re-establish an older
        // session after logout or another sign-in while the request was pending.
        if (getAdminAccessToken() !== tokens.access_token) {
          if (restoreStoredAccessToken()) return;
          if (!getAdminRefreshToken()) expire();
          else setStatus('failed');
          return;
        }
        if (!restoreStoredAccessToken()) expire();
      } catch (error: unknown) {
        if (!active || expired) return;
        if (getAdminTokenRevision() !== revision) {
          if (restoreStoredAccessToken()) return;
          if (!getAdminRefreshToken()) expire();
          else setStatus('failed');
          return;
        }
        const errorStatus =
          typeof error === 'object' && error !== null && 'status' in error
            ? error.status
            : null;
        if (errorStatus === 400 || errorStatus === 401 || errorStatus === 403) {
          expire();
        } else {
          // Preserve the refresh token after a network or server outage.
          setStatus('failed');
        }
      }
    }

    // Tabs share the admin session through localStorage, but each tab's UI only learns
    // of a change from the browser's storage event. Signed out elsewhere: leave the panel
    // now instead of showing cached data until the next request fails. Another admin
    // signed in elsewhere: restore again, as that admin.
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== 'admin_session_id') return;
      const currentSessionId = getAdminSessionId();
      if (currentSessionId === sessionId) return;
      if (!currentSessionId) {
        expire();
        return;
      }
      void queryClient.cancelQueries({ queryKey: ['admin'] });
      queryClient.removeQueries({ queryKey: ['admin'] });
      setStatus('checking');
      setAttempt((value) => value + 1);
    }

    window.addEventListener('admin-session-expired', expire);
    window.addEventListener('storage', onStorage);
    void restore();
    return () => {
      active = false;
      window.removeEventListener('admin-session-expired', expire);
      window.removeEventListener('storage', onStorage);
    };
  }, [attempt, queryClient, router, store]);

  if (status === 'ready' && isAdmin) return children;

  return (
    <main className={styles.screen}>
      {status === 'failed' ? (
        <div className={styles.panel}>
          <p role="alert" className={styles.message}>
            We couldn’t restore your admin session. Check your connection and
            try again.
          </p>
          <Button
            type="button"
            variant="outlined"
            onClick={() => {
              setStatus('checking');
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <p role="status" className={styles.message}>
          Checking your admin session…
        </p>
      )}
    </main>
  );
}
