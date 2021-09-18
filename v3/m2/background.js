/* global core, accounts, CONFIGS, badge, APIEngine, RSSEngine, NativeEngine, sax */

const query = (code, query, stop = true) => {
  return new Promise((resolve, reject) => {
    const results = [];
    let tree;

    const validate = () => {
      if ((query.name ? query.name === tree.name : true) && (query.match ? query.match(tree) : true)) {
        results.push(tree);
        if (stop) {
          resolve(tree);
          throw Error('done');
        }
      }
    };

    class Node {
      constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
        this.children = [];
      }
      closest(name) {
        let p = this.parent;
        while (p && p.name !== name) {
          p = p.parent;
        }
        return p;
      }
      child(query, reverse = false) {
        const once = node => {
          if (node.children) {
            for (const n of (reverse ? [...node.children].reverse() : node.children)) {
              if ((query.name ? query.name === n.name : true) && (query.match ? query.match(n) : true)) {
                return n;
              }
              const r = once(n);
              if (r) {
                return r;
              }
            }
          }
        };
        return once(this);
      }
    }

    const parser = sax.parser(false);
    parser.onopentag = function(node) {
      const child = new Node(node.name, node.attributes);

      if (!tree) {
        tree = child;
      }
      else {
        child.parent = tree;
        tree.children.push(child);
        tree = child;
      }
    };

    parser.onclosetag = function(name) {
      validate();
      if (name === tree.name) {
        if (tree.parent) {
          tree = tree.parent;
        }
      }
    };
    parser.ontext = text => tree.text = text;
    parser.onend = () => {
      resolve(results);
    };
    parser.onerror = e => reject(e);
    parser.write(code).end();
  });
};

const ports = new Set();
core.runtime.port(port => {
  ports.add(port);
  port.onDisconnect.addListener(() => {
    ports.delete(port);
  });
});

const service = {
  users: () => accounts['is-logged-in']().then(async connected => {
    const no = () => {
      core.log('either there is no INTERNET connection or the user is not logged-in');
      return [];
    };

    if (connected) {
      core.log('connection to "Gmail" or "notmuch" is verified');
      const users = await accounts.check();
      core.log('logged-in users', ...users.map(u => u.email));
      if (users.length === 0) {
        connected = await accounts['is-logged-in'](true);
        if (connected === false) {
          return no();
        }

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
        const Engine = name === 'api' ? APIEngine : (name === 'native' ? NativeEngine : RSSEngine);

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
      return no();
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
        }).catch(e => {
          ready.cache.forEach(o => o.reject(e));
        });
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
    core.context.create({
      id: 'refresh-badge',
      title: 'Refresh Badge',
      contexts: ['browser_action']
    });
    core.context.create({
      id: 'clean',
      title: 'Clear Network Caches',
      contexts: ['browser_action']
    });
    core.context.create({
      id: 'restart',
      title: 'Restart Extension',
      contexts: ['browser_action']
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}
core.context.fired(async info => {
  if (info.method === 'clean') {
    await clean(true);
  }

  //
  if (info.menuItemId === 'refresh-badge' || info.menuItemId === 'clean') {
    core.action.set('blue', '...', 'bg_check_new_emails');
    users = {};
    ready.busy = false;
    ready().then(() => badge('popup-load')).catch(e => {
      core.action.set('blue', 'E', e.message);
    });
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
  if (isNaN(badge) || badge === '') {
    core.page.open({
      index: tab.index + 1,
      url: prefs['default-page']
    });
  }
  else {
    if (ports.size) {
      const {tab} = ports.values().next().value.sender;
      core.page.focus(tab);
    }
    else {
      core.page.open({
        index: tab.index + 1,
        url: 'data/popup/index.html'
      });
    }
  }
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
    core.log('read-messages', 'called');

    return run(users[request.user].engine.messages(request.thread));
  }
  else if (request.method === 'run-a-command') {
    core.log('run-a-command', 'called');
    return run(users[request.user].engine.action(request.threads, request.name, request.user, request.query));
  }
  else if (request.method === 'modify-a-message') {
    core.log('modify-a-message', 'called');
    return run(users[request.user].engine.modify(request));
  }
  else if (request.method === 'hard-refresh') {
    users = {};
    ready.busy = false;

    core.action.set('blue', '...', 'bg_check_new_emails');
    ready().then(() => badge('hard-refresh')).then(resposne);

    return true;
  }
  else if (request.method === 'download-an-attachment') {
    core.log('download-an-attachment', 'called');

    return run(users[request.user].engine.attachment(request.message, request.part));
  }
  else if (request.method === 'soft-refresh') {
    setTimeout(() => {
      // if users is empty but we got "soft-refresh", it means the users list is not ready
      if (Object.keys(users).length) {
        badge('soft-refresh');
      }
      else {
        users = {};
        ready.busy = false;

        core.action.set('blue', '...', 'bg_check_new_emails');
        ready().then(() => badge('hard-refresh')).then(resposne);
      }
    }, request.delay || 0);
  }
});

/* caches clean up */
// delete all cached resource with age more than an hour
const clean = (forced = false) => caches.keys().then(async names => {
  const now = Date.now();
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const response = await caches.match(request);
      const date = (new Date(response.headers.get('date'))).getTime();
      if (now - date > 60 * 60 * 1000 || forced) {
        await cache.delete(request);
        core.log('clearing cache for ', request.url);
      }
    }
  }
});
clean();

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
