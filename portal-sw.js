/* ══════════════════════════════════════════════════════
   portal-sw.js — Service Worker for Client Portal
   Handles push notifications for coaching clients.
   ══════════════════════════════════════════════════════ */

/* ── INSTALL ── */
self.addEventListener('install', function() {
});

/* ── ACTIVATE ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

/* ── FETCH — scope guard ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  if (url.pathname.indexOf('portal.html') < 0) return;
});

/* ── PUSH — receive server-sent notification ── */
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var payload;
  try { payload = event.data.json(); } catch (e) {
    payload = { title: 'Big Mike Ely Coaching', body: event.data.text() };
  }

  var title = payload.title || 'Big Mike Ely Coaching';
  var options = {
    body: payload.body || '',
    icon: payload.icon || './icons/icon-192.png',
    badge: payload.badge || './icons/icon-192.png',
    tag: payload.tag || 'portal-' + Date.now(),
    renotify: !!payload.tag,
    requireInteraction: payload.requireInteraction !== false,
    data: {
      url: payload.url || './portal.html',
      type: payload.type || 'general',
      clientId: payload.clientId || null,
      timestamp: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ── NOTIFICATION CLICK — open or focus portal ── */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var data = event.notification.data || {};
  var targetUrl = data.url || './portal.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('portal.html') >= 0 && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* ── PUSH SUBSCRIPTION CHANGE — auto-resubscribe ──
   Defensive: oldSubscription can be null during the pushsubscriptionchange
   event (first install, revoked sub, browsers that don't populate it).
   Fall back to letting the portal's initClientPush() re-establish on
   next visit rather than throwing a TypeError here. */
self.addEventListener('pushsubscriptionchange', function(event) {
  if (!event.oldSubscription || !event.oldSubscription.options) {
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
      console.warn('[portal-sw] resubscribe failed:', e && e.message);
    })
  );
});
