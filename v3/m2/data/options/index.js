/* global core, CONFIGS */

const toast = document.getElementById('toast');

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

const build = prefs => {
  const e = document.getElementById('notifications');
  for (const n of [...e.querySelectorAll('.entry')]) {
    n.remove();
  }

  const t = document.querySelector('#notifications template');
  for (const [user, o] of Object.entries(prefs.notification)) {
    for (const [query, op] of Object.entries(o)) {
      const clone = document.importNode(t.content, true);
      clone.querySelector('[data-id=user]').textContent = user;
      clone.querySelector('[data-id=query]').textContent = query;
      clone.querySelector('[data-id=sound]').textContent = op.sound ? 'True' : 'False';
      clone.querySelector('[data-id=desktop]').textContent = op.desktop ? 'True' : 'False';
      clone.querySelector('[data-id=source]').textContent = op.source;
      clone.querySelector('[data-i18n="op_n_remove"]').value = core.i18n.get('op_n_remove');
      e.appendChild(clone);
    }
  }
  if (Object.keys(prefs.notification).length === 0) {
    e.classList.add('hidden');
  }
};

core.storage.read({
  'opening-mode': CONFIGS['opening-mode'],
  'default-page': CONFIGS['default-page'],
  'default-engine': CONFIGS['default-engine'],
  'badge-text-format': CONFIGS['badge-text-format'],
  'ignored-users': CONFIGS['ignored-users'],
  'notification': CONFIGS['notification'],
  'popup-mark-read-on-view': CONFIGS['popup-mark-read-on-view'],
  'popup-csp': CONFIGS['popup-csp'],
  'badge-period': CONFIGS['badge-period'],
  'api-client-id': CONFIGS['api-client-id']
}).then(prefs => {
  document.getElementById('opening-mode').value = prefs['opening-mode'];
  document.getElementById('default-page').value = prefs['default-page'];
  document.getElementById('default-engine').value = prefs['default-engine'];
  document.getElementById('badge-text-format').value = prefs['badge-text-format'];
  document.getElementById('ignored-users').value = prefs['ignored-users'];
  document.getElementById('popup-mark-read-on-view').checked = prefs['popup-mark-read-on-view'];
  document.getElementById('popup-csp').value = prefs['popup-csp'];
  document.getElementById('badge-period').value = prefs['badge-period'];
  document.getElementById('api-client-id').value = prefs['api-client-id'];

  build(prefs);
});

document.getElementById('add-notification').addEventListener('submit', async e => {
  e.preventDefault();

  const prefs = await core.storage.read({
    'notification': CONFIGS['notification']
  });
  const user = e.target.elements.user.value;
  const query = e.target.elements.query.value;
  prefs.notification[user] = prefs.notification[user] || {};
  prefs.notification[user][query] = {
    sound: e.target.elements.sound.checked,
    desktop: e.target.elements.desktop.checked,
    source: e.target.elements.source.value
  };
  await core.storage.write(prefs);
  build(prefs);
});

document.getElementById('add-custom-sound').addEventListener('change', e => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = async () => {
    e.value = '';
    const code = await crypto.subtle.digest('SHA-256', reader.result);
    const hash = Array.from(new Uint8Array(code)).map(b => b.toString(16).padStart(2, '0')).join('');

    const prefs = await core.storage.read({
      'custom-sounds': CONFIGS['custom-sounds']
    });
    const next = n => {
      document.querySelector('#add-notification [name="source"]').value = n;
      alert(core.i18n.get('op_msg_sound_id').replace('%%', n));
    };

    if (prefs['custom-sounds'][hash]) {
      next(prefs['custom-sounds'][hash].id);
    }
    else {
      const r = new FileReader();
      r.onload = async () => {
        let id = 10;
        while (Object.values(prefs['custom-sounds']).some(o => o.id === id)) {
          id += 1;
        }
        prefs['custom-sounds'][hash] = {
          id,
          binary: r.result
        };
        await core.storage.write(prefs);
        next(id);
      };
      r.readAsDataURL(file);
    }
  };
  if (file.size < 2 * 1024 * 1024) {
    reader.readAsArrayBuffer(file);
  }
  else {
    alert(core.i18n.get('op_msg_large_file'));
  }
});
document.getElementById('notifications').addEventListener('click', async e => {
  if (e.target.dataset.command === 'remove') {
    const parent = e.target.closest('.entry');
    const user = parent.querySelector('[data-id=user]').textContent;
    const query = parent.querySelector('[data-id=query]').textContent;
    const prefs = await core.storage.read({
      'notification': CONFIGS['notification']
    });
    delete prefs.notification[user][query];
    if (Object.keys(prefs.notification[user]).length === 0) {
      delete prefs.notification[user];
    }
    await core.storage.write(prefs);
    parent.remove();
  }
});

// save
document.getElementById('save').addEventListener('click', async () => {
  await core.storage.write({
    'opening-mode': document.getElementById('opening-mode').value,
    'default-page': document.getElementById('default-page').value,
    'default-engine': document.getElementById('default-engine').value,
    'badge-text-format': document.getElementById('badge-text-format').value,
    'ignored-users': document.getElementById('ignored-users').value,
    'popup-mark-read-on-view': document.getElementById('popup-mark-read-on-view').checked,
    'popup-csp': document.getElementById('popup-csp').value,
    'badge-period': Math.max(1, document.getElementById('badge-period').value),
    'badge-delay': Math.max(1, document.getElementById('badge-period').value),
    'api-client-id': document.getElementById('api-client-id').value
  });
  toast.textContent = core.i18n.get('op_msg_saved');
  setTimeout(() => toast.textContent = '', 2000);
});
// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    toast.textContent = core.i18n.get('op_msg_reset');
    window.setTimeout(() => toast.textContent = '', 2000);
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});
// support
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
}));
// native
document.getElementById('native').addEventListener('click', () => chrome.permissions.request({
  permissions: ['nativeMessaging']
}, granted => {
  if (granted) {
    core.runtime.post({
      method: 'hard-refresh'
    });
  }
}));
