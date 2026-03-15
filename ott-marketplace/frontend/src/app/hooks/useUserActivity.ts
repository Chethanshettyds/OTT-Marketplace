import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

let activitySocket: Socket | null = null;

export function useUserActivity() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only track non-admin authenticated users
    if (!isAuthenticated || !user?._id || isAdmin) return;

    if (!activitySocket) {
      activitySocket = io('/', { path: '/socket.io', transports: ['websocket'] });
    }

    const emit = (page: string) => {
      activitySocket?.emit('heartbeat', {
        userId: user._id,
        page,
      });
    };

    // Announce on connect / reconnect
    activitySocket.emit('user_connect', {
      userId: user._id,
      name: user.name,
      email: user.email,
      page: location.pathname,
    });

    // Heartbeat every 30s
    emit(location.pathname);
    intervalRef.current = setInterval(() => emit(location.pathname), 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, user?._id, location.pathname]);

  // Cleanup on logout
  useEffect(() => {
    if (!isAuthenticated) {
      activitySocket?.disconnect();
      activitySocket = null;
    }
  }, [isAuthenticated]);
}
