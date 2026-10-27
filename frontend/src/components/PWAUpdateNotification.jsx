import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Sparkles, X, ArrowRight } from 'lucide-react';

const PWAUpdateNotification = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service Worker registered:', swUrl);
      if (registration) {
        // Periodically check for new updates every 30 seconds
        const intervalId = setInterval(() => {
          registration.update().catch(err => {
            console.debug('[PWA] Periodic update check failed:', err);
          });
        }, 30 * 1000);

        // Also check whenever user switches back to the app / window is focused
        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(err => {
              console.debug('[PWA] Focus update check failed:', err);
            });
          }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onVisibilityChange);

        return () => {
          clearInterval(intervalId);
          document.removeEventListener('visibilitychange', onVisibilityChange);
          window.removeEventListener('focus', onVisibilityChange);
        };
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error);
    },
  });

  // Check immediately on mount as well
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.update().catch(() => {});
      });
    }
  }, []);

  // When needRefresh triggers, fire a single native OS/Browser notification if permitted
  useEffect(() => {
    if (needRefresh) {
      setDismissed(false);

      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            const notif = new Notification('Lectra App Update Available', {
              body: 'New website updates are available. Click to update the app.',
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: 'lectra-app-update', // Single notification tag ensures no duplicates
              renotify: true,
            });

            notif.onclick = () => {
              window.focus();
              handleUpdate();
            };
          } catch (e) {
            console.debug('[PWA] Notification dispatch failed:', e);
          }
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }
    }
  }, [needRefresh]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch (err) {
      console.error('[PWA] Failed to update service worker:', err);
      window.location.reload();
    }
  };

  if (!needRefresh || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[9999] animate-bounce-in">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/95 dark:bg-slate-950/95 text-white p-5 shadow-2xl border-2 border-primary/40 backdrop-blur-xl ring-4 ring-primary/10">
        {/* Glow ambient background */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/30 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
          title="Dismiss notification"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3.5">
          {/* Animated Icon */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-primary/30 animate-pulse">
            <Sparkles size={24} className="text-white" />
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary-light text-[10px] font-black uppercase tracking-wider border border-primary/30">
                New Version
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Updated</span>
            </div>

            <h4 className="text-sm font-black text-white tracking-tight">
              App Update Available
            </h4>
            
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              New website updates have been deployed. Click below to load latest features into the app.
            </p>

            {/* Action Button */}
            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="btn-primary py-2.5 px-4 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/40 w-full sm:w-auto cursor-pointer"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Updating App...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Click to Update App</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAUpdateNotification;
