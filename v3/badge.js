/* global core ready users CONFIGS */

const notify = () => core.storage.read({
  'notification': CONFIGS['notification'],
  'notification-counts': CONFIGS['notification-counts']
}).then(prefs => {
  for (const [user, o] of Object.entries(users)) {
    for (const [query, e] of Object.entries(o.queries || {})) {
      const old = prefs['notification-counts'][user]?.[query]?.count;
      const count = e.resultSizeEstimate;
      if (isNaN(old) === false && count > old) {
        prefs['notification-counts'][user] = prefs['notification-counts'][user] || {};
        prefs['notification-counts'][user][query] = {
          count,
          date: Date.now()
        };
        core.log('count mismatch', user, query, 'old', old, 'new', count);
        if (count > old) {
          const o = prefs.notification[user]?.[query];
          if (o) {
            if (o.sound) {
              notify.sound(o);
            }
            if (o.desktop) {
              notify.desktop(user, query, count);
            }
          }
          else {
            notify.sound({
              source: 0
            });
            notify.desktop(user, query, count);
          }
        }
      }
    }
  }
  core.storage.write(prefs);
});
notify.sound = ({source}) => core.storage.read({
  'custom-sounds': CONFIGS['custom-sounds'],
  'sound-volume': CONFIGS['sound-volume']
}).then(prefs => {
  let href = 'data/sounds/' + source + '.wav';
  if (source >= 10) {
    href = Object.values(prefs['custom-sounds']).filter(o => o.id === source).map(o => o.binary).shift() ||
      'data/sounds/0.wav';
  }
  const audio = new Audio(href);
  audio.volume = prefs['sound-volume'];
  audio.play();
});
notify.desktop = (user, query, count) => core.storage.read({
  'notification-text-format': CONFIGS['notification-text-format']
}).then(prefs => core.notify.create({
  message: prefs['notification-text-format']
    .replace('{USER}', user)
    .replace('{QUERY}', query)
    .replace('{COUNT}', count)
}));

const badge = window.badge = async reason => {
  core.log('badge is called', reason);
  try {
    await ready();
    const prefs = await core.storage.read({
      'queries': CONFIGS['queries'],
      'default-queries': CONFIGS['default-queries'],
      'badge-format': CONFIGS['badge-text-format'],
      'opening-mode': CONFIGS['opening-mode']
    });
    const brokens = [];
    await Promise.all(Object.values(users).map(async user => {
      user.queries = user.queries || {};

      const queries = (prefs.queries[user.email] || prefs['default-queries']).filter(s => s !== 'IGNORE');
      return Promise.all(queries.map(query => user.engine.threads(query, false).then(o => {
        user.queries[query] = o;
      }).catch(e => {
        brokens.push(user.email);
        user.queries = {};
        core.log(user.email, 'is logged-out', e.message);
      })));
    }));
    core.runtime.post({
      method: 'users-updated',
      users
    });
    const count = Object.values(users).map(o => o.queries).map(qs => Object.values(qs)).flat()
      .reduce((p, c) => p + c.resultSizeEstimate, 0);
    core.log('badge is resolved', count);

    core.action.popup(count !== 0 && prefs['opening-mode'] === 'popup' ? 'data/popup/index.html?mode=popup' : '');

    if (count === 0) {
      let color = brokens.length ? 'blue' : 'gray';
      // what if there is no logged-in account
      if (Object.values(users).length === 0) {
        color = 'blue';
      }
      let msg = core.i18n.get('bg_no_message') + '\n\n' +
        core.i18n.get('bg_no_message_logged_in') + ': ' +
        Object.keys(users).filter(u => brokens.indexOf(u) === -1).join(', ');
      if (brokens.length) {
        msg += '\n\n' + core.i18n.get('bg_no_message_logged_out') + ': ' + brokens.join(', ');
      }
      core.action.set(color, '', msg);

      core.runtime.post({
        method: 'close-popup'
      });
    }
    else {
      const msg = [];
      for (const user of Object.values(users)) {
        if (Object.keys(user.queries).length) {
          const m = prefs['badge-format']
            .replace('{EMAIL}', user.email)
            .replace('{DATE}', (new Date()).toLocaleString());

          msg.push(m.replace(/(.*)@@(.*)/, (a, b, c) => {
            return Object.entries(user.queries).map(([query, o]) => {
              return b + c
                .replace('{QUERY}', query)
                .replace('{EMAIL}', user.email)
                .replace('{COUNT}', o.resultSizeEstimate)
                .replace('{SNIPPET}', o.snippet);
            }).join('\n');
          }));
        }
      }
      core.action.set(brokens.length ? 'blue' : 'red', count, msg.join('\n\n'));
    }
    notify();
  }
  catch (e) {
    console.warn('Unexpected Error', e);
    core.action.set('blue', 'E', core.i18n.get('bg_unexpected_error') + ': ' + e.message);
  }
};
core.runtime.start(() => {
  core.action.set('blue', '...', core.i18n.get('bg_check_new_emails'));
  badge('first-run');
  core.storage.read({
    'badge-period': CONFIGS['badge-period'], // minutes
    'badge-delay': CONFIGS['badge-delay'], // minutes
    'idle-detection': CONFIGS['idle-detection'] // minutes
  }).then(prefs => {
    core.alarms.create('badge', {
      when: Date.now() + prefs['badge-delay'] * 60 * 1000,
      periodInMinutes: prefs['badge-period']
    });
    core.idle.set(prefs['idle-detection'] * 60);
  });
});
core.alarms.fired(alarm => {
  if (alarm.name === 'badge') {
    badge('alarm');
  }
});
window.addEventListener('online', () => badge('online'));
core.idle.fired(name => name === 'active' && badge('idle'));

/* storage calls */
core.storage.changed(ps => {
  if (
    ps['badge-text-format'] || ps['queries'] || ps['default-queries'] || ps['notification'] ||
    ps['ignored-users'] || ps['opening-mode'] || ps['api-client-id']
  ) {
    badge('prefs-changed');
  }
});
