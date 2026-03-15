import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../utils/api';
import { useAuth } from './useAuth';

export interface NotifCounts { support: number; broadcasts: number; }

const STORAGE_KEY = 'ottmarket_notif_counts';

function loadCached(): NotifCounts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { support: 0, broadcasts: 0 };
}

function saveCached(counts: NotifCounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
}

let socketRef: Socket | null = null;

export function useNotifications() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [counts, setCounts] = useState<NotifCounts>(loadCached);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateCounts = useCallback((partial: Partial<NotifCounts>) => {
    setCounts((prev) => {
      const next = { ...prev, ...partial };
      // For incremental updates (socket), add rather than replace
      if (partial.support !== undefined && partial.support === 1 && prev.support !== undefined) {
        next.support = prev.support + 1;
      }
      if (partial.broadcasts !== undefined && partial.broadcasts === 1 && prev.broadcasts !== undefined) {
        next.broadcasts = prev.broadcasts + 1;
      }
      saveCached(next);
      return next;
    });
  }, []);

  const fetchCounts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.get<NotifCounts>('/notifications/counts');
      setCounts(data);
      saveCached(data);
    } catch { /* ignore */ }
  }, [isAuthenticated]);

  const markRead = useCallback(async (type: 'support' | 'broadcasts', ticketId?: string) => {
    // Optimistic update
    setCounts((prev) => {
      const next = { ...prev, [type]: ticketId ? Math.max(0, prev[type] - 1) : 0 };
      saveCached(next);
      return next;
    });
    try {
      await api.post('/notifications/mark-read', { type, ticketId });
      // Re-fetch to confirm server state
      const { data } = await api.get<NotifCounts>('/notifications/counts');
      setCounts(data);
      saveCached(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;

    fetchCounts();

    // Poll every 30s
    pollRef.current = setInterval(fetchCounts, 30_000);

    // Socket
    if (!socketRef) {
      socketRef = io('/', { path: '/socket.io', transports: ['websocket'] });
    }
    if (isAdmin) {
      socketRef.emit('join_admin');
      socketRef.on('admin_notification_update', (data: Partial<NotifCounts>) => {
        setCounts((prev) => {
          const next = { ...prev, ...data };
          saveCached(next);
          return next;
        });
      });
    } else {
      socketRef.emit('join_user', { userId: user._id });
      socketRef.on('notification_update', (data: Partial<NotifCounts>) => {
        updateCounts(data);
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
      setCounts({ support: 0, broadcasts: 0 });
      saveCached({ support: 0, broadcasts: 0 });
    }
  }, [isAuthenticated]);

  return { counts, markRead, fetchCounts };
}
