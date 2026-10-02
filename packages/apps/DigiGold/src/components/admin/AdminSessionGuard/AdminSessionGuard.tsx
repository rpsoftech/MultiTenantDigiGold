'use client';

import { useEffect, useState } from 'react';
import { useStore } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { adminAuthService } from '@/features/admin-auth/admin-auth.service';
import { adminSessionUser } from '@/features/admin-auth/admin-session';
import {
  clearAdminTokens,
  getAdminAccessToken,
  getAdminRefreshToken,
  getAdminTokenRevision,
} from '@/lib/api/admin-tokens';
import { ROUTES } from '@/lib/constants/routes';
import type { RootState } from '@/store';
import { useAppSelector } from '@/store/hooks';
import {
  selectIsAdmin,
  sessionCleared,
  sessionEstablished,
} from '@/store/session/session.slice';

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

    function expire() {
      if (!active || expired) return;
      expired = true;
      setStatus('checking');
      clearAdminTokens();
      void queryClient.cancelQueries({ queryKey: ['admin'] });
      queryClient.removeQueries({ queryKey: ['admin'] });
      if (store.getState().session.user?.role === 'admin') {
        store.dispatch(sessionCleared());
      }
      router.replace(ROUTES.adminLogin);
    }

    function restoreStoredAccessToken(): boolean {
      const token = getAdminAccessToken();
      if (!token) return false;
      try {
        const user = adminSessionUser(token);
        store.dispatch(sessionEstablished(user));
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

    window.addEventListener('admin-session-expired', expire);
    void restore();
    return () => {
      active = false;
      window.removeEventListener('admin-session-expired', expire);
    };
  }, [attempt, queryClient, router, store]);

  if (status === 'ready' && isAdmin) return children;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      {status === 'failed' ? (
        <div className="max-w-sm space-y-4 text-center">
          <p role="alert" className="text-sm text-slate-600">
            We couldn’t restore your admin session. Check your connection and
            try again.
          </p>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white"
            onClick={() => {
              setStatus('checking');
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        <p role="status" className="text-sm text-slate-600">
          Checking your admin session…
        </p>
      )}
    </main>
  );
}
