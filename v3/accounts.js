/* global core, CONFIGS, NativeEngine, sax, clean */

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
      child(query, reverse = false, stop = true) {
        const matches = [];
        const once = node => {
          if (node.children) {
            for (const n of (reverse ? [...node.children].reverse() : node.children)) {
              if ((query.name ? query.name === n.name : true) && (query.match ? query.match(n) : true)) {
                return n;
              }
              const r = once(n);
              if (r && stop) {
                return r;
              }
              else if (r) {
                matches.push(r);
              }
            }
          }
        };
        const r = once(this);
        return stop ? r : matches;
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
        const o = await query(bodies[m], {
          match(node) {
            return node.name === 'TITLE';
          }
        });
        const email = o?.text.split(' for ')[1];

        if (o && email && emails.indexOf(email) === -1) {
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
  'is-logged-in'(forced = false) {
    // Google
    const g = async () => {
      const now = Date.now();
      if (forced === false) {
        const prefs = await core.storage.read({
          'last-check': 0
        });
        if (now - prefs['last-check'] < 60 * 60 * 1000) {
          return true;
        }
      }
      const r = await fetch('https://mail.google.com/mail/?ui=html&zy=h');
      const b = r.ok && r.url.indexOf('accounts.google') === -1;
      core.storage.write({
        'last-check': b ? now : 0
      });
      if (!b) { // make sure all caches are cleared
        clean(true);
      }
      return b;
    };
    // notmuch
    const n = async () => {
      const engine = new NativeEngine();
      try {
        await engine.authorize();
        const user = await engine.introduce();
        accounts.local = user;
        return Boolean(user);
      }
      catch (e) {
        return false;
      }
    };

    return Promise.all([g(), n()]).then(([remote, local]) => {
      return remote || local;
    });
  }
};
