import { useState, useEffect, useRef, useCallback } from 'react';
import { getPendingNotifications, markNotificationRead } from '../services/api';
import { getSession } from '../services/session';

const POLL_INTERVAL_MS = 15000; // poll every 15 seconds

/**
 * Polls /api/notifications/pending and returns unread notifications.
 * Cleans up poll on unmount.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const sessionId = await getSession();
      if (!sessionId) return;
      const data = await getPendingNotifications(sessionId);
      setNotifications(data || []);
      setHasUnread((data || []).length > 0);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const dismiss = useCallback(async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setHasUnread(prev => notifications.length - 1 > 0);
    } catch {
      // Optimistic update already applied — ignore error
    }
  }, [notifications.length]);

  return { notifications, hasUnread, dismiss, refetch: fetchNotifications };
}
