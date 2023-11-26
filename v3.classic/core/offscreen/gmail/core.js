const gmail = {};
const cache = {
  iks: new Map(),
  ats: new Map()
};
gmail.page = n => {
  if (cache.iks.has(n)) {
    return Promise.resolve(cache.iks.get(n));
  }

  const page = localStorage.getItem('page-' + n) || `https://mail.google.com/mail/u/${n}/s/`;

  const next = async href => {
    const r = await fetch(href, {
      credentials: 'include'
    });
    if (r.ok) {
      const content = await r.text();
      const m = content.match(/ID_KEY\s*=\s*['"](?<ik>[^'"]*)['"]/);

      if (m) {
        cache.iks.set(n, m.groups);
        return m.groups;
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const meta = doc.querySelector('meta[http-equiv="refresh"]');
      if (meta) {
        const url = meta.content.split('url=')[1];
        if (url) {
          const o = new URL(url, page);
          localStorage.setItem('page-' + n, o.href);

          return next(o.href);
        }
      }
    }
    throw Error('core.js -> id_key');
  };

  return next(page);
};
gmail.at = n => {
  if (cache.ats.has(n)) {
    return Promise.resolve(cache.ats.get(n));
  }

  return new Promise((resolve, reject) => chrome.runtime.sendMessage({
    method: 'get-at',
    n
  }, at => {
    if (at) {
      cache.ats.set(n, at);
      resolve(at);
    }
    // backup plan
    else {
      console.info('[core]', 'Using alternative method to get GAMIL_AT');

      fetch(`https://mail.google.com/mail/u/${n}/h/`).then(r => {
        if (r.ok) {
          return r.text();
        }
        throw Error('core.js -> at -> ' + r.status);
      }).then(content => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        const e = doc.querySelector('a[href*="at="]');
        const input = doc.querySelector('[name="at"]'); // do you really want to use this view

        if (e) {
          const args = new URLSearchParams(e.href.split('?')[1]);
          if (args.has('at')) {
            cache.ats.set(n, args.get('at'));
            return resolve(args.get('at'));
          }
        }
        if (input && input.value) {
          cache.ats.set(n, input.value);
          return resolve(input.value);
        }
        throw Error('core.js -> at (h)');
      }).then(resolve, reject);
    }
  }));
};


gmail.search = async ({url, query}) => {
  const m = url.match(/u\/(?<n>\d+)/);
  if (m) {
    const {n} = m.groups;
    const {ik} = await gmail.page(n);
    if (!ik) {
      throw Error('core.js -> ik -> empty');
    }
    const at = await gmail.at(n);
    if (!at) {
      throw Error('core.js -> at -> empty');
    }
    const body = new URLSearchParams();
    body.append('s_jr', JSON.stringify([null, [
      [null, null, null, null, null, null, [null, true, false]],
      [null, [null, query, 0, null, 80, null, null, null, false, [], [], true]]
    ], 2, null, null, null, ik]));

    const href = `https://mail.google.com/mail/u/${n}/s/?v=or&ik=${ik}&at=${at}&subui=chrome&hl=en&ts=` + Date.now();
    const r = await fetch(href, {
      method: 'POST',
      credentials: 'include',
      body
    });
    if (!r.ok) {
      throw Error('core.js -> body: ' + r.status);
    }
    const content = await r.text();
    const parts = content.split(/\d+&/);
    const results = parts[2];
    const j = JSON.parse(results);
    const entries = j[1][0][2][5].map(a => {
      const entry = {};
      entry.subject = a[3];
      entry.thread = a[11];
      entry.labels = a[8] || [];
      entry.date = a[7];
      entry.from = a[5];
      entry.text = a[4];

      try {
        if (a[10][2] === 1) {
          entry.labels.push('STARRED');
        }
      }
      catch (e) {}
      return entry;
    });

    return {
      'count': entries.length,
      'name': 'NA',
      'logged-in': true,
      'responseURL': r.responseURL,
      entries
    };
  }
  else {
    throw Error('core.js -> valid_m');
  }
};

gmail.action = async ({links, cmd, prefs}) => {
  links = typeof links === 'string' ? [links] : links;

  const a = links.map(link => {
    const m = link.match(/u\/(?<n>\d+).*message_id=(?<thread>[^&]+)/);
    if (m) {
      return m.groups;
    }
  }).filter(o => o);
  if (a.length) {
    const at = await gmail.at(a[0].n);
    if (!at) {
      throw Error('core.js -> at');
    }
    const {ik} = await gmail.page(a[0].n);
    if (!ik) {
      throw Error('core.js -> ik');
    }

    const action = {
      command: 'l:all',
      labels: [],
      ids: []
    };

    if (cmd === 'rd' || cmd === 'rd-all') { // mark as read
      action.code = 3;
    }
    else if (cmd === 'rc_^i' || cmd === 'rc_Inbox') { // archive
      action.code = 1;
      if (prefs.doReadOnArchive === true || prefs.doReadOnArchive === 'true') {
        gmail.action({
          links,
          cmd: 'rd',
          prefs
        });
      }
    }
    else if (cmd === 'sp' || cmd === 'rc_Spam') { // report spam
      action.code = 7;
    }
    else if (cmd === 'tr') { // trash
      action.code = 9;
    }
    else if (cmd === 'st') { // star
      action.code = 5;
    }
    else if (cmd === 'xst') { // remove star
      action.code = 6;
    }
    else if (cmd.startsWith('rc_')) { // add or remove labels
      // action.labels = cmd.slice(3);
    }
    if (!action.code) {
      throw Error('core.js -> action_not_supported: ' + cmd);
    }

    const body = new FormData();
    body.append('s_jr', JSON.stringify([null, [
      ...a.map(o => [null, null, null, [
        null, action.code, o.thread, (o.id || o.thread), action.command, [], action.labels, o.ids
      ]]),
      [null, null, null, null, null, null, [null, true, false]],
      [null, null, null, null, null, null, [null, true, false]]
    ], 2, null, null, null, ik]));

    const href = `https://mail.google.com/mail/u/${a[0].n}/s/?v=or&ik=${ik}&at=${at}&subui=chrome&hl=en&ts=` + Date.now();
    return fetch(href, {
      method: 'POST',
      credentials: 'include',
      body
    });
  }
  throw Error('core.js -> no_links');
};
