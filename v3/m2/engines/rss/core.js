/* global query, core */

class RSSEngine {
  constructor(cnfg = {}) {
    this.TYPE = 'RSS';
    this.CACHE = 'rss-v1';
    this.user = {
      queries: {}
    };
    this.config = Object.assign({
      blind: 'https://mail.google.com/mail/?ui=html&zy=h',
      timeout: 30 * 60 * 1000
    }, cnfg);
  }
  update() {
    return Promise.resolve();
  }
  async clean() {
    const cache = await caches.open(this.CACHE);
    for (const request of await cache.keys()) {
      await cache.delete(request);
    }
  }
  authorize() {
    return Promise.reject(Error('User need to login using Gmail interface'));
  }
  async get(path, properties = {}, skip = false) {
    const href = path.startsWith('http') ? path : this.base + path;

    const request = new Request(href, properties);
    const cache = await caches.open(this.CACHE);
    const now = Date.now();
    let response = await caches.match(request);
    if (response) {
      const date = (new Date(response.headers.get('date'))).getTime();
      if (now - date < this.config.timeout) {
        if (skip) {
          return response;
        }
        return await response.text();
      }
    }
    core.log(request.method, href);
    response = await fetch(request);
    if (response.ok && response.url.indexOf('accounts.google') === -1) {
      // caching
      if (request.method === 'GET') {
        cache.put(request, response.clone());
      }
      if (skip) {
        return response;
      }
      return await response.text();
    }
    else {
      this.clean();
    }
    throw Error('Request rejected');
  }
  async bypass(at) {
    const body = new URLSearchParams();
    body.append('at', at);
    await fetch(this.base.split('?')[0] + '?a=uia', {
      method: 'POST',
      body
    });
  }
  async introduce(user, step = 0) {
    const href = await this.get(this.config.blind, {}, true).then(r => r.url);
    if (href.indexOf('/u/') === -1) {
      throw Error('cannot find basic HTML view from the blind URL');
    }
    this.user.id = user.id;
    this.base = href.replace(/\/u\/\d+/, '/u/' + user.id).split('?')[0];

    const content = await this.get(this.base);

    // do you really want to use this view
    const input = await query(content, { // doc.querySelector('[name="at"]');
      match(node) {
        return node?.attributes.NAME === 'at';
      }
    });

    if (input && step === 0) {
      await this.bypass(input.value);
      return this.introduce(user, step += 1);
    }

    try {
      const email = await query(content, {
        match(node) {
          return node?.attributes?.CLASS?.indexOf('gb4') !== -1;
        }
      }).text;
      this.user.id = 0;
      this.user.email = email;
      return email;
    }
    catch (e) {
      console.warn(e);
      throw Error('Cannot extract email from interface');
    }
  }
  async labels() {
    const labels = [];
    const content = await this.get(this.base);
    // system
    const a = await query(content, { // [href="?&"]
      name: 'A',
      match(node) {
        return node?.attributes?.HREF === '?&';
      }
    });
    if (a) {
      const table = a.closest('table');
      [...table.querySelectorAll('a[href]')].forEach(e => {
        const href = e.getAttribute('href');
        if (href === '?&cs=b&pv=tl&v=b') { // compose
          return;
        }
        if (href === '?&v=cl') { // contacts
          return;
        }
        const m = /\((\d+)\)$/.exec(e.textContent);
        labels.push({
          name: m ? e.textContent.replace(m[0], '').trim() : e.textContent,
          count: m ? Number(m[1]) : 0,
          type: 'system',
          href: e.href
        });
      });
    }
    else {
      throw Error('Cannot find "INBOX" link');
    }
    // user
    const b = await query(content, { // doc.querySelector('[href="?&v=prl"]'); // edit labels
      match(node) {
        return node?.attributes?.HREF.indexOf('?&v=prl') !== -1;
      }
    });
    if (b) {
      const table = b.closest('TABLE');
      [...table.querySelectorAll('a[href]')].forEach(e => {
        const href = e.getAttribute('href');
        if (href === '?&v=prl') { // edit labels
          return;
        }
        const m = /\((\d+)\)$/.exec(e.textContent);
        labels.push({
          name: m ? e.textContent.replace(m[0], '') : e.textContent,
          count: m ? Number(m[1]) : 0,
          type: 'user',
          href: e.href
        });
      });
    }
    else {
      throw Error('Cannot find "Edit labels" link');
    }
    this.user.labels = labels;
    return labels;
  }
  async at() {
    const content = await this.get(this.base);
    const e1 = await query(content, { // doc.querySelector('a[href*="at="]');
      name: 'A',
      match(node) {
        return node?.attributes?.HREF.indexOf('at=') !== -1;
      }
    });
    if (e1 && e1.attributes) {
      const args = new URLSearchParams(e1.attributes.HREF.split('?')[1]);
      const at = args.get('at');
      if (!at) {
        throw Error('cannot extract "at" from the base page');
      }
      return at;
    }

    const input = await query(content, { // doc.querySelector('[name="at"]'); // do you really want to use this view
      match(node) {
        return node?.attributes?.NAME === 'at';
      }
    });

    // allow access to the HTML version
    if (input && input.attributes) {
      await this.bypass(input.attributes.VALUE);
      return input.attributes.VALUE;
    }
    throw Error('cannot get "at" from the base page');
  }
  async threads(q, cache = true) {
    const at = await this.at();
    const body = new URLSearchParams();
    body.append('s', 'q');
    body.append('q', q);
    body.append('nvp_site_mail', 'Search Mail');
    body.append('at', at);

    const headers = {};
    if (cache === false) {
      headers['cache-control'] = 'no-cache';
    }

    const content = await this.get(this.base.split('?')[0] + '?s=q&q=' + encodeURIComponent(q) + '&nvp_site_mail=Search%20Mail', {
      method: 'POST',
      body,
      headers
    });
    const as = await query(content, { // [...doc.querySelectorAll('a[href*="&th="]')];
      name: 'A',
      match(node) {
        return node?.attributes?.HREF.indexOf('&th=') !== -1;
      }
    }, false);
    let resultSizeEstimate = 0;
    if (as.length) {
      // Gmail does not return the exact number. Try to get it from the interface
      if (q === 'label:INBOX is:unread') {
        const a = await query(content, { // doc.querySelector('a[href="?&"]');
          name: 'A',
          match(node) {
            return node?.attributes?.HREF === '?&';
          }
        });
        if (a) {
          const m = /\d+/.exec(a.text.replace(/[,.]/g, ''));
          if (m && isNaN(m[0]) === false) {
            resultSizeEstimate = Number(m[0]);
          }
        }
      }
      if (resultSizeEstimate === 0) {
        // doc.querySelector('form[name=f] td[align="right"] b:last-of-type');
        const t = (await query(content, {
          name: 'FORM',
          match(node) {
            return node?.attributes.NAME === 'f';
          }
        }))?.child({
          name: 'TD',
          match(n) {
            return n?.attributes.ALIGN === 'right';
          }
        })?.child({name: 'B'}, true);

        if (!t) {
          throw Error('Cannot detect resultSizeEstimate');
        }
        const n = Number(t.text.replace(/[,.]/g, '')); // 3,650 -> 3650
        if (isNaN(n) === false) {
          resultSizeEstimate = n;
        }
      }
    }

    const threads = as.map(a => {
      const thread = {};
      const tr = a.closest('TR');

      // const es = ts.children.length === 3 ? ts.children : ts.childNodes;
      // if (es.length < 3) {
      //   throw Error('Cannot extract "labels", "title", and "snippet" from the element');
      // }
      const snippet = a.child({name: 'FONT'}, true); // ts.querySelector('font:last-child');

      thread.snippet = snippet ? snippet.text.replace(/^ - /, '') : '';

      const ts = a.child({
        match(n) {
          return n?.attributes?.CLASS?.indexOf('ts') !== -1;
        }
      });
      const subject = ts.children[1].name === 'B' ? ts.children[1] : ts;

      thread.href = a.attributes.HREF;
      thread.id = a.attributes.HREF.split('th=')[1].split('&')[0];

      const date = tr.child({name: 'TD'}, true);
      const labels = a.child({
        name: 'FONT',
        match(n) {
          return n?.attributes.SIZE === '1';
        }
      })?.child({name: 'FONT'});
      const from = tr.children[1].child({name: 'B'}) || tr.children[1];

      thread.messages = {
        labelIds: labels?.text?.split(/\s*,\s*/).filter(a => a) || [],
        date: date.text || date.children[0].text,
        // date: 'FFF', // ts.closest('td').nextElementSibling.textContent
        payload: {
          mimeType: 'multipart/alternative',
          headers: [{
            name: 'Subject',
            value: subject.text
          }, {
            name: 'From',
            value: from.text.replace(/\s+\(\d+\)$/, '')
            // value: 'FRRRRR' // ts.closest('td').previousElementSibling.textContent.replace(/\s+\(\d+\)$/, '')
          }]
        }
      };
      if (subject.name === 'B') {
        thread.messages.labelIds.push('UNREAD');
      }
      const img = tr.child({ // querySelector('img[alt=Starred]')
        name: 'INPUT',
        match(n) {
          return n?.attributes?.NAME === 't';
        }
      })?.child({name: 'IMG'});
      if (img && img?.attributes?.SRC?.indexOf('star') !== -1) {
        thread.messages.labelIds.push('STARRED');
      }
      return thread;
    });


    this.user.queries[query] = threads;

    return {
      resultSizeEstimate,
      threads
    };
  }
  async thread(o) {
    const href = o.href.replace('&v=c', '&v=pt');
    const content = await this.get(href);

    let labelIds = o.messages.labelIds;
    // try to update labels since "o" might be outdated
    for (const threads of Object.values(this.user.queries)) {
      for (const thread of threads) {
        if (thread.id === o.id) {
          labelIds = thread.messages.labelIds;
          break;
        }
      }
    }
    const to = (await query(content, {
      name: 'FONT',
      match(n) {
        return n?.attributes?.CLASS?.indexOf('recipient') !== -1;
      }
    }))?.child({name: 'DIV'})?.text.replace('To: ', '') || 'NA';

    return {
      href,
      messages: [{
        id: o.id,
        labelIds,
        payload: {
          mimeType: 'multipart/alternative',
          parts: [{
            mimeType: 'text/plain',
            body: {
              'raw-html': content
            }
          }, {
            mimeType: 'text/html',
            body: {
              'raw-html': content
            }
          }],
          headers: [{
            name: 'To',
            value: to
          }, ...o.messages.payload.headers]
        },
        snippet: o.snippet
      }]
    };
  }
  async action(threads, name, user, query) {
    const shortcuts = {
      'mark-as-unread': {
        'tact': 'ur',
        'nvp_tbu_go': 'Go'
      },
      'mark-as-read': {
        'tact': 'rd',
        'nvp_tbu_go': 'Go'
      },
      'archive': {
        'tact': 'arch',
        'nvp_tbu_go': 'Go'
      },
      'delete': {
        'tact': '',
        'nvp_a_tr': 'Delete'
      },
      'move-to-inbox': {
        'tact': '',
        'nvp_a_ib': 'Move to Inbox'
      },
      'report': {
        'tact': '',
        'nvp_a_sp': 'Report Spam'
      },
      'add-star': {
        'tact': 'st',
        'nvp_tbu_go': 'Go',
        'bact': ''
      },
      'remove-star': {
        'tact': 'xst',
        'nvp_tbu_go': 'Go',
        'bact': ''
      }
    };
    const command = shortcuts[name];
    const at = await this.at();

    const body = new URLSearchParams();
    body.append('at', at);
    for (const [key, value] of Object.entries(command)) {
      body.append(key, value);
    }
    for (const thread of threads) {
      body.append('t', thread.id);
    }
    body.append('bact', '');
    await this.get(this.base.split('?')['0'] + '?&s=a', {
      method: 'POST',
      body
    }, true);
    await this.update();
  }
  async modify({message, addLabelIds = [], removeLabelIds = []}) {
    const at = await this.at();
    const body = new URLSearchParams();
    body.append('redir', '?&');
    body.append('at', at);
    for (const s of addLabelIds) {
      body.append('tact', 'ac_' + s);
    }
    for (const s of removeLabelIds) {
      body.append('tact', 'rc_' + s);
    }
    body.append('nvp_tbu_go', 'Go');
    body.append('t', message.id);
    body.append('bact', '');
    await this.get(this.base.split('?')['0'] + '?&s=a', {
      method: 'POST',
      body
    }, true);
    await this.update();
  }
}
