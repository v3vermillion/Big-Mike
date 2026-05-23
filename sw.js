var CACHE_NAME = 'bigmike-v3';
/* Pre-cache the app shell so the full site works offline after one
   visit. Marketing pages + shared CSS/JS included so the complete
   funnel survives a flaky connection during onboarding. */
var APP_SHELL = [
  './',
  './index.html',
  './app.html',
  './book.html',
  './portal.html',
  './onboard.html',
  './about.html',
  './services.html',
  './results.html',
  './platform.html',
  './gallery.html',
  './contact.html',
  './404.html',
  './css/site.css?v=v3',
  './js/site.js?v=v3',
  './book-manifest.json'
];

/* ── INSTALL ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      /* addAll is atomic — one 404 fails the whole install. Use
         individual cache.add calls with per-file error tolerance so
         a missing optional file doesn't break the SW install. */
      return Promise.all(APP_SHELL.map(function(url) {
        return cache.add(url).catch(function(e) {
          console.warn('[sw] failed to precache', url, e && e.message);
        });
      }));
    })
  );
  self.skipWaiting();
});

/* ── ACTIVATE ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

/* ── FETCH — caching strategy ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Bypass cache for Supabase API calls
  if (url.hostname.indexOf('supabase.co') >= 0) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for same-origin HTML (always get fresh content)
  if (url.hostname === location.hostname &&
      (event.request.mode === 'navigate' || url.pathname.match(/\.(html?)$/))) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Network-first for CDN resources (fonts, external scripts)
  if (url.hostname !== location.hostname) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first for images and static assets (fast loading)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});

/* ── SKIP WAITING — allow page to force-activate new SW ── */
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ═══════════════════════════════════════════════════════════
   WEB PUSH NOTIFICATIONS
   Handles incoming push messages and notification interactions.
   Works when the app is closed, in the background, or the phone
   is locked — this is what makes it feel like a real app.
   ═══════════════════════════════════════════════════════════ */

/* ── PUSH — receive server-sent notification ── */
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var payload;
  try { payload = event.data.json(); } catch (e) {
    // Plain text fallback
    payload = { title: 'Big Mike Ely Coaching', body: event.data.text() };
  }

  var title = payload.title || 'Coaching Lab';
  var options = {
    body: payload.body || '',
    icon: payload.icon || './icons/icon-192.png',
    badge: payload.badge || './icons/icon-192.png',
    tag: payload.tag || 'coaching-' + Date.now(),
    renotify: !!payload.tag, // vibrate again if same tag updates
    requireInteraction: payload.requireInteraction !== false,
    data: {
      url: payload.url || './app.html',
      type: payload.type || 'general',
      sessionId: payload.sessionId || null,
      clientId: payload.clientId || null,
      timestamp: Date.now()
    },
    actions: []
  };

  // Contextual actions based on notification type
  if (payload.type === 'new_booking') {
    options.actions = [
      { action: 'view_schedule', title: 'View Schedule' },
      { action: 'dismiss', title: 'Dismiss' }
    ];
  } else if (payload.type === 'session_reminder') {
    options.actions = [
      { action: 'view_schedule', title: 'View Session' },
      { action: 'dismiss', title: 'Got It' }
    ];
  } else if (payload.type === 'cancellation') {
    options.actions = [
      { action: 'view_schedule', title: 'View Schedule' },
      { action: 'dismiss', title: 'Dismiss' }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ── NOTIFICATION CLICK — deep link into the app ── */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Determine the target URL based on action and notification data
  var data = event.notification.data || {};
  var targetUrl = data.url || './app.html';

  if (event.action === 'view_schedule') {
    targetUrl = './app.html#schedule';
  } else if (event.action === 'dismiss') {
    return; // Just close the notification
  }

  // Focus existing window or open new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to focus an existing app window
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('app.html') >= 0 && 'focus' in client) {
          // Tell the app to navigate to the right tab
          client.postMessage({
            type: 'push_navigate',
            tab: data.type === 'new_booking' || data.type === 'session_reminder' || data.type === 'cancellation' ? 'schedule' : 'home',
            sessionId: data.sessionId,
            clientId: data.clientId
          });
          return client.focus();
        }
      }
      // No existing window — open fresh
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* ── NOTIFICATION CLOSE — cleanup (no-op for now, hook for analytics) ── */
self.addEventListener('notificationclose', function(event) {
  // Future: track dismissed notifications for relevance tuning
});

/* ── PUSH SUBSCRIPTION CHANGE — auto-resubscribe ──
   Guards against null event.oldSubscription (first install, revoked
   subscription, or browsers that don't populate this field). If the
   old subscription options aren't available, we fall back to the app
   re-running its initPush() flow on next page load. */
self.addEventListener('pushsubscriptionchange', function(event) {
  if (!event.oldSubscription || !event.oldSubscription.options) {
    // Can't silently resubscribe without the original options — the
    // app's initPush() flow will recreate on next visit.
    return;
  }
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options).then(function(newSub) {
      return self.clients.matchAll().then(function(clientList) {
        clientList.forEach(function(client) {
          client.postMessage({
            type: 'push_resubscribed',
            subscription: newSub.toJSON()
          });
        });
      });
    }).catch(function(e) {
      console.warn('[sw] resubscribe failed:', e && e.message);
    })
  );
});
