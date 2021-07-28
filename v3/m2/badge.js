/* global core ready users CONFIGS */

const notify = () => core.storage.read({
  'notification': CONFIGS['notification'],
  'notification-counts': CONFIGS['notification-counts'],
  'popup-switch-on-new': CONFIGS['popup-switch-on-new']
}).then(prefs => {
  for (const [user, o] of Object.entries(users)) {
    for (const [query, e] of Object.entries(o.queries || {})) {
      const old = prefs['notification-counts'][user]?.[query]?.count;
      const count = e.resultSizeEstimate;
      prefs['notification-counts'][user] = prefs['notification-counts'][user] || {};
      prefs['notification-counts'][user][query] = {
        count,
        date: Date.now()
      };
      if (isNaN(old) === false && count > old) {
        core.log('count mismatch', user, query, 'old', old, 'new', count);
        if (count > old) {
          const threads = e.threads.slice(0, count - old);
          // notify
          const o = prefs.notification[user]?.[query];
          if (o) {
            if (o.sound) {
              notify.sound(o);
            }
            if (o.desktop) {
              notify.desktop(user, query, count, threads);
            }
          }
          else {
            notify.sound({
              source: 0
            });
            notify.desktop(user, query, count, threads);
          }
          // adjust popup view
          if (prefs['popup-switch-on-new']) {
            core.storage.write({
              'popup-account': {
                user,
                query,
                threads: threads[0].id
              }
            });
          }
        }
      }
    }
  }
  // save
  core.storage.write({
    'notification-counts': prefs['notification-counts']
  });
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
notify.desktop = (user, query, count, threads) => core.storage.read({
  'notification-delay': CONFIGS['notification-delay'], // ms
  'notification-type': CONFIGS['notification-type'],
  'notification-text-format-combined': CONFIGS['notification-text-format-combined'],
  'notification-text-format-each': CONFIGS['notification-text-format-each'],
  'notification-buttons': CONFIGS['notification-buttons'],
  'notification-max-per-account': CONFIGS['notification-max-per-account']
}).then(async prefs => {
  if (prefs['notification-type'] === 'combined') {
    core.notify.create(JSON.stringify([threads[0].id, user]), {
      message: prefs['notification-text-format-combined']
        .replace('{USER}', user)
        .replace('{QUERY}', query)
        .replace('{COUNT}', count)
        .replace('{SNIPPET}', '...')
    });
  }
  else {
    for (const thread of threads.slice(0, prefs['notification-max-per-account'])) {
      const map = {};
      map['mark-as-read'] = await core.i18n.translate('bg_no_mark_as_read');
      map['report'] = await core.i18n.translate('bg_no_report');
      map['archive'] = await core.i18n.translate('bg_no_archive');
      map['delete'] = await core.i18n.translate('bg_no_delete');
      map['add-star'] = await core.i18n.translate('bg_no_add_star');

      const buttons = prefs['notification-buttons'].map(command => ({
        title: map[command]
      }));

      core.notify.create(JSON.stringify([thread.id, user, prefs['notification-buttons']]), {
        message: prefs['notification-text-format-each']
          .replace('{USER}', user)
          .replace('{QUERY}', query)
          .replace('{COUNT}', count)
          .replace('{SNIPPET}', thread.snippet),
        buttons
      });
      await new Promise(resolve => setTimeout(resolve, prefs['notification-delay']));
    }
  }
});
core.notify.fired(str => {
  try {
    const [id, user] = JSON.parse(str);
    core.page.open({
      url: users[user].href
    });
  }
  catch (e) {
    console.warn(e);
  }
});
core.notify.buttons((str, n) => {
  try {
    const [id, user, commands] = JSON.parse(str);
    const command = commands[n];
    users[user].engine.action([{id}], command)
      .catch(e => console.warn('cannot perform action', e, command, user));
  }
  catch (e) {
    console.warn(e);
  }
});

const badge = async reason => {
  const now = Date.now();
  if (now - badge.date < 500) {
    core.log('Badge is called too soon. Ignoring this request', reason);
    return Promise.resolve();
  }
  badge.date = now;

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

      const queries = (prefs.queries[user.email] || prefs['default-queries']);
      if (queries.length === 0) {
        queries.push(...prefs['default-queries']);
      }

      return Promise.all(queries.map(query => user.engine.threads(query, false).then(o => {
        user.queries[query] = o;
      }).catch(e => {
        brokens.push(user.email);
        user.queries = {};
        console.warn(e);
        core.log(user.email, 'is logged-out', e.message);
      })));
    }));
    core.runtime.post({
      method: 'users-updated'
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

      let msg = color === 'blue' ?
        await core.i18n.translate('bg_sign_out') :
        await core.i18n.translate('bg_no_message') + '\n\n' +
        await core.i18n.translate('bg_no_message_logged_in') + ': ' +
        Object.keys(users).filter(u => brokens.indexOf(u) === -1).join(', ');

      if (brokens.length) {
        msg += '\n\n' + await core.i18n.translate('bg_no_message_logged_out') + ': ' + brokens.join(', ');
      }
      core.action.set(color, '', '', msg);

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
      core.action.set(
        brokens.length ? 'blue' : 'red',
        count > 999 ? (count / 1000).toFixed() + 'k' : count,
        '',
        msg.join('\n\n')
      );
    }
    notify();
  }
  catch (e) {
    console.warn('Unexpected Error', e);
    core.action.set('blue', 'E', 'bg_unexpected_error', ': ' + e.message);
  }
};

core.runtime.start(() => {
  core.action.set('blue', '...', 'bg_check_new_emails');
  badge('first-run');
  core.storage.read({
    'badge-period': CONFIGS['badge-period'], // minutes
    'badge-delay': CONFIGS['badge-delay'], // minutes
    'badge-color': CONFIGS['badge-color'],
    'idle-detection': CONFIGS['idle-detection'] // minutes
  }).then(prefs => {
    core.action.color(prefs['badge-color']);

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
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => badge('online'));
}
core.idle.fired(name => name === 'active' && badge('idle'));

/*
  storage calls

  ignore: ps['queries'] since it is fired by hard-refresh

*/
core.storage.changed(ps => {
  if (
    ps['badge-text-format'] || ps['default-queries'] || ps['notification'] ||
    ps['ignored-users'] || ps['opening-mode'] || ps['api-client-id']
  ) {
    badge('prefs-changed');
  }
  if (ps['badge-period'] || ps['badge-delay']) {
    core.storage.read({
      'badge-period': CONFIGS['badge-period'], // minutes
      'badge-delay': CONFIGS['badge-delay'] // minutes
    }).then(prefs => {
      core.alarms.create('badge', {
        when: Date.now() + prefs['badge-delay'] * 60 * 1000,
        periodInMinutes: prefs['badge-period']
      });
    });
  }
});
