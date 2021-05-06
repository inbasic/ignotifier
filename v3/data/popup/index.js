/* global core, api, command, CONFIGS */

/* localization */
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  if (e.dataset.i18nValue) {
    e.setAttribute(e.dataset.i18nValue, core.i18n.get(e.dataset.i18n));
  }
  else {
    e.textContent = core.i18n.get(e.dataset.i18n);
  }
});
[...document.querySelectorAll('[data-i18n-title]')].forEach(e => {
  e.title = core.i18n.get(e.dataset.i18nTitle);
});

/* args */
const args = new URLSearchParams(location.search);
if (args.get('mode') === 'popup') {
  document.body.classList.add('popup');
}
const active = {
  get user() {
    return document.getElementById('user').value;
  },
  get query() {
    return document.getElementById('search').value;
  },
  users: {}
};

const post = window.post = request => new Promise(resolve => {
  chrome.runtime.sendMessage(Object.assign({}, request, {
    user: active.user,
    query: active.query
  }), resolve);
});

/* navigate */
document.getElementById('previous').addEventListener('click', () => api.navigate('previous'));
document.getElementById('next').addEventListener('click', () => api.navigate('next'));

/* click on entries */
document.getElementById('entries').addEventListener('click', e => {
  if (e.target.dataset.id === 'star') {
    const input = e.target.parentElement.querySelector('input');
    if (input.dataset.star === 'true') {
      input.dataset.star = false;
      command(e, 'remove-star');
    }
    else {
      input.dataset.star = true;
      command(e, 'add-star');
    }

    e.stopPropagation();
    e.preventDefault();
    return;
  }

  if (e.isTrusted || e.detail['consider-trusted']) {
    const meta = e.ctrlKey || e.metaKey;
    if (meta !== true) {
      // remove old selected
      for (const input of api.dom.entries(true)) {
        if (e.target !== input) {
          input.checked = false;
        }
      }
    }
  }
});

/* view an email */
document.getElementById('entries').addEventListener('change', () => {
  const inputs = api.dom.entries(true);
  if (inputs.length) {
    api.view.display(inputs.map(e => e.thread));
    // mark as read if there is at least one unread message
    if (inputs.some(i => i.thread.messages.labelIds.indexOf('UNREAD') !== -1)) {
      core.storage.read({
        'popup-mark-read-on-view': CONFIGS['popup-mark-read-on-view']
      }).then(prefs => {
        if (prefs['popup-mark-read-on-view']) {
          const target = document.getElementById('mark-as-read');
          command({
            target
          }, 'mark-as-read', false);
        }
      });
    }
  }
  else {
    api.view.clear();
  }
});

/* updating */
document.getElementById('entries').addEventListener('change', e => {
  api.update.buttons(e);
});
document.getElementById('search').addEventListener('search', () => {
  api.update.notification();
});
document.getElementById('user').addEventListener('change', () => api.query.build());

/* searching from datalist */
document.getElementById('search').addEventListener('keyup', e => {
  if (!e.key) { // keyup is from datalist
    e.target.dispatchEvent(new Event('search'));
  }
});
/* searching */
document.getElementById('search').addEventListener('search', async e => {
  const q = e.target.value.trim();
  if (q === '') {
    return;
  }

  // do we have the results of this query
  document.getElementById('entries').classList.add('loading');
  api.entries.clear();
  api.view.clear();
  if (q) {
    const query = active.users[active.user]?.queries[q] || await post({
      method: 'search-for-emails'
    });
    if (query.threads) {
      for (let i = 0; i < query.threads.length; i += 3) {
        await Promise.all([0, 1, 2].map(async n => {
          const thread = query.threads[n + i];
          if (thread) {
            if (thread.messages) {
              return;
            }
            else {
              try {
                thread.messages = await post({
                  method: 'read-messages',
                  thread
                });
              }
              catch (e) {}
            }
          }
        }));
      }
      await api.entries.build(query.threads, e);
    }
  }
  document.getElementById('entries').classList.remove('loading');
});

/* save session */
{
  const save = () => {
    console.log('saving', document.readyState);
    core.storage.write({
      'popup-account': {
        user: active.user,
        query: active.query,
        threads: api.dom.entries(true).map(i => i.dataset.thread)
      }
    });
  };
  // navigate button, keyboard shortcut, click on an entry
  document.getElementById('entries').addEventListener('change', e => e.isTrusted && save());
  document.getElementById('search').addEventListener('search', e => e.isTrusted && save());
}

/* toggle notifications */
document.getElementById('sound').addEventListener('click', async e => {
  e.target.classList.toggle('active');
  let queries = await api.users.queries();
  if (e.target.classList.contains('active')) {
    queries.push(active.query);
  }
  else {
    const n = queries.indexOf(active.query);
    if (n !== -1) {
      queries.splice(n, 1);
    }
  }
  queries = queries.filter(s => s !== 'IGNORE');
  // user wants to ignore this account
  if (queries.length === 0) {
    queries.push('IGNORE');
  }

  const prefs = await core.storage.read({
    'queries': CONFIGS['queries']
  });
  prefs.queries[active.user] = queries;
  await core.storage.write(prefs);
  await post({
    method: 'hard-refresh'
  });
});

/* expand button */
document.getElementById('expand').onclick = () => {
  document.body.classList.toggle('collapsed');
  document.getElementById('entries').dispatchEvent(new Event('change'));
  core.storage.write({
    mode: document.body.classList.contains('collapsed') ? 'collapsed' : 'expanded'
  });
};
core.storage.read({
  mode: CONFIGS['popup-mode']
}).then(prefs => {
  // only on the popup mode
  if (args.get('mode') === 'popup') {
    document.body.classList[prefs.mode === 'collapsed' ? 'add' : 'remove']('collapsed');
  }
  else {
    document.body.classList.remove('collapsed');
  }
});

/* view */
core.storage.read({
  'popup-view': CONFIGS['popup-view'],
  'grid-view': CONFIGS['grid-view']
}).then(prefs => {
  document.body.classList[prefs['popup-view'] === 'single' ? 'add' : 'remove']('single');
  document.body.dataset.view = prefs['grid-view'];
});
document.getElementById('view').onclick = async () => {
  const prefs = await core.storage.read({
    'popup-view': CONFIGS['popup-view'],
    'grid-view': CONFIGS['grid-view']
  });
  if (prefs['popup-view'] === 'single') {
    prefs['popup-view'] = 'grid';
    prefs['grid-view'] = '12';
  }
  else if (prefs['grid-view'] === '12') {
    prefs['grid-view'] = '11';
  }
  else if (prefs['grid-view'] === '11') {
    prefs['grid-view'] = '1_2';
  }
  else if (prefs['grid-view'] === '1_2') {
    prefs['grid-view'] = '1_1';
  }
  else if (prefs['grid-view'] === '1_1') {
    prefs['popup-view'] = 'single';
  }
  document.body.classList[prefs['popup-view'] === 'single' ? 'add' : 'remove']('single');
  document.body.dataset.view = prefs['grid-view'];
  core.storage.write(prefs);
};

/* start */
(async () => {
  document.body.classList.add('loading');

  active.users = await post({
    method: 'get-users'
  });

  // build users
  await api.users.build();

  document.body.classList.remove('loading');
})();


core.runtime.message(request => {
  if (request.method === 'close-popup' && args.get('mode') === 'popup') {
    window.close();
  }
});

