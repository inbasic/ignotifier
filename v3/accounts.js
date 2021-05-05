/* global core, CONFIGS */
const accounts = {
  number: 0,
  local: '',
  async check() {
    const db = [];
    for (let n = 0; n < 20; n += 3) {
      const hrefs = [
        `https://mail.google.com/mail/u/${n}/feed/atom/inbox`,
        `https://mail.google.com/mail/u/${n + 1}/feed/atom/inbox`,
        `https://mail.google.com/mail/u/${n + 2}/feed/atom/inbox`
      ];

      const bodies = await Promise.all(hrefs.map(h => fetch(h).then(r => r.text())));
      const emails = [];
      for (let m = 0; m < 3; m += 1) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(bodies[m], 'text/xml');
        // const href = doc.querySelector('link').getAttribute('href');
        const email = doc.querySelector('title').textContent.split(' for ')[1];
        if (emails.indexOf(email) === -1) {
          emails.push(email);
          db.push({
            href: hrefs[m].split('/feed/')[0],
            id: n + m,
            email
          });
        }
        else {
          const r = await core.storage.read({
            'ignored-users': CONFIGS['ignored-users']
          }).then(prefs => db.filter(o => {
            const n = prefs['ignored-users'].indexOf(o.email);
            if (n === -1) {
              return true;
            }
            core.log('ignoring', o.email);
            return false;
          }));
          if (accounts.local) {
            r.push({
              email: accounts.local,
              native: true
            });
          }

          return r;
        }
      }
    }
    throw Error('maximum reached');
  },
  'is-logged-in'() {
    return Promise.all([
      fetch('https://mail.google.com/mail/?ui=html&zy=h').then(r => r.ok),
      import('./engines/native.js').then(o => {
        const Engine = o.default;
        const engine = new Engine();

        return engine.authorize().then(() => engine.introduce()).then(user => {
          accounts.local = user;
          return Boolean(user);
        }).catch(() => false);
      })
    ]).then(([remote, local]) => {
      return remote || local;
    });
  }
};
