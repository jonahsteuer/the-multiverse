'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppNotification } from '@/types';
import { subscribeToNotifications } from '@/lib/team';

interface NotificationBellProps {
  userId: string;
  onNotificationClick?: (notification: AppNotification) => void;
}

/** Format relative time */
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/** Get notification icon */
function getNotificationIcon(type: string): string {
  switch (type) {
    case 'task_assigned': return '📋';
    case 'task_completed': return '✅';
    case 'task_rescheduled': return '🔄';
    case 'invite_accepted': return '🤝';
    case 'member_joined': return '👋';
    case 'brainstorm_completed': return '💡';
    case 'brainstorm_revision': return '📝';
    default: return '🔔';
  }
}

export function NotificationBell({ userId, onNotificationClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/team/notifications?limit=20');
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount((data.notifications || []).filter((n: AppNotification) => !n.read).length);
      }
    } catch (err) {
      console.error('[Notifications] Failed to load:', err);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userId) return;

    const subscription = subscribeToNotifications(userId, (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(prev => prev + 1);
      // Show toast
      showToast(newNotif);
    });

    return () => subscription.unsubscribe();
  }, [userId]);

  // Mark notification as read
  const markRead = async (notificationId: string) => {
    try {
      await fetch('/api/team/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[Notifications] Failed to mark read:', err);
    }
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      await fetch('/api/team/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[Notifications] Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read) {
      markRead(notification.id);
    }
    onNotificationClick?.(notification);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors text-left border-b border-gray-800/50 last:border-b-0 ${
                    !notif.read ? 'bg-purple-500/5' : ''
                  }`}
                >
                  {/* Icon */}
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${notif.read ? 'text-gray-400' : 'text-white font-medium'}`}>
                      {notif.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {notif.message}
                    </div>
                  </div>

                  {/* Time + unread dot */}
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">{formatRelativeTime(notif.createdAt)}</span>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================================

let toastContainer: HTMLDivElement | null = null;

function getToastContainer(): HTMLDivElement {
  if (toastContainer) return toastContainer;

  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  `;
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(notification: AppNotification) {
  if (typeof window === 'undefined') return;

  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    border: 1px solid rgba(147, 51, 234, 0.3);
    border-radius: 12px;
    padding: 12px 16px;
    max-width: 320px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    pointer-events: auto;
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
  `;

  toast.innerHTML = `
    <span style="font-size: 18px;">${getNotificationIcon(notification.type)}</span>
    <div style="flex: 1; min-width: 0;">
      <div style="color: white; font-size: 13px; font-weight: 600;">${notification.title}</div>
      <div style="color: #9ca3af; font-size: 12px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${notification.message}</div>
    </div>
    <button style="color: #6b7280; font-size: 16px; cursor: pointer; background: none; border: none; padding: 0; line-height: 1;">&times;</button>
  `;

  // Add animation styles
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Close button
  const closeBtn = toast.querySelector('button');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeToast(toast);
  });

  // Click to dismiss
  toast.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  // Auto-dismiss after 5 seconds
  setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast: HTMLDivElement) {
  toast.style.animation = 'slideOut 0.3s ease-in forwards';
  setTimeout(() => {
    toast.remove();
  }, 300);
}

