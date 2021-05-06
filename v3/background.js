/* global core, accounts, CONFIGS, badge */

const service = {
  users: () => accounts['is-logged-in']().then(async connected => {
    if (connected) {
      core.log('connection to "Gmail" or "notmuch" is verified');
      const users = await accounts.check();
      core.log('logged-in users', users);
      if (users.length === 0) {
        core.log('Cannot fetch user list although the user is logged-in');
        users.push({
          email: 'me',
          href: 'https://mail.google.com/mail/u/0',
          id: 0
        });
      }
      const prefs = await core.storage.read({
        engine: CONFIGS['default-engine'],
        map: CONFIGS['default-engine-mapping']
      });
      await Promise.all(users.map(async user => {
        let name = prefs.map[user.email] || prefs.engine;
        if (user.native) {
          name = 'native';
        }
        const {
          default: Engine
        } = name === 'api' ? await import('./engines/api.js') : (
          name === 'native' ? await import('./engines/native.js') : await import('./engines/rss.js')
        );
        core.log('user', user.email, 'uses', name, 'engine');

        user.engine = new Engine();
        user.engine.update = () => badge('engine-internal-request');
        if (name === 'api') {
          try {
            try {
              await user.engine.introduce(user);
            }
            catch (e) {
              await user.engine.authorize(false, true);
              await user.engine.introduce(user);
            }
          }
          catch (e) {
            user.disconnected = true;
            core.log('cannot access', user.email, e.message);
          }
        }
        else {
          await user.engine.introduce(user);
        }
      }));
      return users.filter(u => u.disconnected !== true);
    }
    else {
      core.log('either there is no INTERNET connection or the user is not logged-in');
    }
  })
};

let users = {};

/* if users is needed call this function first */
const ready = () => {
  if (Object.keys(users).length === 0) {
    return new Promise((resolve, reject) => {
      ready.cache.push({resolve, reject});
      if (ready.busy === false) {
        ready.busy = true;
        service.users().then(us => {
          for (const user of us) {
            users[user.email] = user;
          }
          ready.cache.forEach(o => o.resolve());
        }).catch(e => ready.cache.forEach(o => o.reject(e)));
      }
    });
  }
  return Promise.resolve();
};
ready.cache = [];
ready.busy = false;

/* context menu */
{
  const once = () => {
    chrome.contextMenus.create({
      id: 'refresh-badge',
      title: 'Refresh Badge',
      contexts: ['browser_action']
    });
    chrome.contextMenus.create({
      id: 'restart',
      title: 'Restart Extension',
      contexts: ['browser_action']
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'refresh-badge') {
    core.action.set('blue', '...', core.i18n.get('bg_check_new_emails'));
    users = {};
    ready.busy = false;
    ready().then(() => badge('popup-load'));
  }
  else if (info.menuItemId == 'restart') {
    core.runtime.reload();
  }
});

/* action */
core.action.click(async tab => {
  const badge = await core.action.badge();
  const prefs = await core.storage.read({
    'default-page': CONFIGS['default-page']
  });
  core.page.open({
    index: tab.index + 1,
    url: isNaN(badge) || badge === '' ? prefs['default-page'] : 'data/popup/index.html'
  });
});

/* runtime */
chrome.runtime.onMessage.addListener((request, sender, resposne) => {
  const run = method => {
    try {
      method.then(resposne).catch(e => resposne({
        error: e.message
      }));
    }
    catch (e) {
      core.log('Unexpected Error', e);
      resposne({
        error: {
          message: e.message
        }
      });
    }
    return true;
  };

  if (request.method === 'get-users') {
    core.log('get-users', 'called');
    ready().then(async () => {
      const keys = Object.keys(users);
      // make sure each user has the "queries" array; otherwise badge() is not being called for this session
      if (keys.length) {
        if ('queries' in users[keys[0]]) {
          resposne(users);
        }
        else {
          await badge('return-from-idle');
          resposne(users);
        }
      }
      else {
        resposne(users);
      }
    });
    return true;
  }
  else if (request.method === 'search-for-emails') {
    core.log('search-for-emails', 'called');
    users[request.user].engine.threads(request.query).then(resposne);
    return true;
  }
  else if (request.method === 'read-a-thread') {
    core.log('read-a-thread', 'called');
    return run(users[request.user].engine.thread(request.thread));
  }
  else if (request.method === 'read-messages') {
    core.log('read-a-thread', 'called');

    return run(users[request.user].engine.messages(request.thread));
  }
  else if (request.method === 'run-a-command') {
    core.log('run-a-command', 'called');
    return run(users[request.user].engine.action(request.threads, request.name));
  }
  else if (request.method === 'modify-a-message') {
    core.log('modify-a-message', 'called');
    return run(users[request.user].engine.modify(request));
  }
  else if (request.method === 'hard-refresh') {
    users = {};
    ready.busy = false;
    core.action.set('blue', '...', core.i18n.get('bg_check_new_emails'));
    ready().then(() => badge('hard-refresh')).then(resposne);

    return true;
  }
  else if (request.method === 'download-an-attachment') {
    core.log('download-an-attachment', 'called');

    return run(users[request.user].engine.attachment(request.message, request.part));
  }
  else if (request.method === 'soft-refresh') {
    badge('soft-refresh');
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
