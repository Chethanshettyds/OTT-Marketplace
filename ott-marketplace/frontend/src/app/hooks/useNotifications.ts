import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';
import { useAuth } from './useAuth';

export interface NotifCounts { support: number; broadcasts: number; }

const STORAGE_KEY = 'ottmarket_notif_counts';

// ── Shared singleton state so all hook instances stay in sync ─────────────────
type Listener = (counts: NotifCounts) => void;
const listeners = new Set<Listener>();
let sharedCounts: NotifCounts = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { support: 0, broadcasts: 0 };
})();

function setShared(next: NotifCounts) {
  sharedCounts = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn(next));
}

function updateShared(partial: Partial<NotifCounts>) {
  setShared({ ...sharedCounts, ...partial });
}
// ─────────────────────────────────────────────────────────────────────────────

let socketRef: Socket | null = null;

export function useNotifications() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [counts, setCounts] = useState<NotifCounts>(() => sharedCounts);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to shared state changes
  useEffect(() => {
    const listener: Listener = (c) => setCounts(c);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const fetchCounts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.get<NotifCounts>('/notifications/counts');
      setShared(data);
    } catch { /* ignore */ }
  }, [isAuthenticated]);

  const markRead = useCallback(async (type: 'support' | 'broadcasts', ticketId?: string) => {
    // Optimistic update — clear immediately
    const next = { ...sharedCounts, [type]: ticketId ? Math.max(0, sharedCounts[type] - 1) : 0 };
    setShared(next);
    try {
      await api.post('/notifications/mark-read', { type, ticketId });
      // Re-fetch to get accurate server count
      const { data } = await api.get<NotifCounts>('/notifications/counts');
      setShared(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;

    fetchCounts();
    pollRef.current = setInterval(fetchCounts, 30_000);

    if (!socketRef) {
      socketRef = io('/', { path: '/socket.io', transports: ['websocket'] });
    }

    if (isAdmin) {
      socketRef.emit('join_admin');
      socketRef.on('admin_notification_update', (data: Partial<NotifCounts>) => {
        updateShared(data);
      });
    } else {
      socketRef.emit('join_user', { userId: user._id });
      socketRef.on('notification_update', (data: Partial<NotifCounts>) => {
        // For socket incremental pushes, add to existing count
        const next: NotifCounts = { ...sharedCounts };
        if (data.support !== undefined) next.support = sharedCounts.support + data.support;
        if (data.broadcasts !== undefined) next.broadcasts = sharedCounts.broadcasts + data.broadcasts;
        setShared(next);
      });
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      socketRef?.off('notification_update');
      socketRef?.off('admin_notification_update');
    };
  }, [isAuthenticated, user?._id]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setShared({ support: 0, broadcasts: 0 });
    }
  }, [isAuthenticated]);

  return { counts, markRead, fetchCounts };
}
