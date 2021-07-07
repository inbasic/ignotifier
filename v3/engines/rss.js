const config = {
  blind: ' https://mail.google.com/mail/?ui=html&zy=h'
};

class Engine {
  constructor(cnfg = {}) {
    this.TYPE = 'RSS';
    this.user = {
      queries: {}
    };
    Object.assign(config, cnfg);
  }
  update() {
    return Promise.resolve();
  }
  authorize() {
    return Promise.reject(Error('User need to login using Gmail interface'));
  }
  get(path, type = 'doc', properties = {}) {
    const href = path.startsWith('http') ? path : this.base + path;
    return fetch(href, properties).then(async r => {
      if (r.ok) {
        if (type === '') {
          return;
        }
        const content = await r.text();
        if (type === 'doc') {
          const parser = new DOMParser();
          return parser.parseFromString(content, 'text/html');
        }
        else {
          return content;
        }
      }
      else {
        throw Error('Request rejected');
      }
    });
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
    const href = await fetch(config.blind).then(r => r.url);
    if (href.indexOf('/u/') === -1) {
      throw Error('cannot find basic HTML view from the blind URL');
    }
    this.user.id = user.id;
    this.base = href.replace(/\/u\/\d+/, '/u/' + user.id);

    const doc = await this.get(this.base, 'doc');
    const input = doc.querySelector('[name="at"]'); // do you really want to use this view
    if (input && step === 0) {
      await this.bypass(input.value);
      return this.introduce(user, step += 1);
    }

    try {
      const email = doc.querySelector('.gb4').textContent;
      this.user.id = 0;
      this.user.email = email;
      return email;
    }
    catch (e) {
      throw Error('Cannot extract email from interface');
    }
  }
  async labels() {
    const labels = [];
    const doc = await this.get(this.base);
    // system
    const a = doc.querySelector('[href="?&"]');
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
    const b = doc.querySelector('[href="?&v=prl"]'); // edit labels
    if (b) {
      const table = b.closest('table');
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
    const doc = await this.get(this.base);
    const e = doc.querySelector('a[href*="at="]');
    const input = doc.querySelector('[name="at"]'); // do you really want to use this view

    if (e) {
      const args = new URLSearchParams(e.href.split('?')[1]);
      const at = args.get('at');
      if (!at) {
        throw Error('cannot extract "at" from the base page');
      }
      return at;
    }
    // allow access to the HTML version
    else if (input) {
      this.bypass(input.value);
      return input.value;
    }
    else {
      throw Error('cannot get "at" from the base page');
    }
  }
  async threads(query, cache = true) {
    const at = await this.at();
    const body = new URLSearchParams();
    body.append('s', 'q');
    body.append('q', query);
    body.append('nvp_site_mail', 'Search Mail');
    body.append('at', at);

    const headers = {};
    if (cache === false) {
      headers['cache-control'] = 'no-cache';
    }

    const doc = await this.get(this.base.split('?')[0] + '?s=q&q=' + encodeURIComponent(query) + '&nvp_site_mail=Search%20Mail', 'doc', {
      method: 'POST',
      body,
      headers
    });
    const as = [...doc.querySelectorAll('a[href*="&th="]')];
    let resultSizeEstimate = 0;
    if (as.length) {
      const t = doc.querySelector('form[name=f] td[align="right"] b:last-of-type');
      if (!t) {
        throw Error('Cannot detect resultSizeEstimate');
      }
      resultSizeEstimate = Number(t.textContent);
    }

    const threads = as.map(a => {
      const thread = {};
      const ts = a.querySelector('.ts');
      const es = ts.children.length === 3 ? ts.children : ts.childNodes;
      if (es.length < 3) {
        throw Error('Cannot extract "labels", "title", and "snippet" from the element');
      }
      const snippet = ts.querySelector('.ts > font:last-child');
      thread.snippet = snippet ? snippet.textContent.replace(/^ - /, '') : '';

      const subject = ts.querySelector('b') || es[1];

      thread.href = a.href;
      thread.id = a.href.split('th=')[1].split('&')[0];

      thread.messages = {
        labelIds: [...es[0].textContent.split(/\s*,\s*/)].filter(a => a),
        date: ts.closest('td').nextElementSibling.textContent,
        payload: {
          mimeType: 'multipart/alternative',
          headers: [{
            name: 'Subject',
            value: subject.nodeValue || subject.textContent
          }, {
            name: 'From',
            value: ts.closest('td').previousElementSibling.textContent.replace(/\s+\(\d+\)$/, '')
          }]
        }
      };
      if (subject.nodeType !== Element.TEXT_NODE) {
        thread.messages.labelIds.push('UNREAD');
      }
      if (a.closest('tr').querySelector('img[alt=Starred]')) {
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
    const doc = await this.get(href);

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

    const body = doc.querySelector('.maincontent > table:last-child tr:last-child div');
    // prevent redirects
    for (const a of [...body.querySelectorAll('a[href^="https://www.google.com/url?q="]')]) {
      const href = a.href;
      const args = new URLSearchParams(href.split('?')[1]);
      a.setAttribute('href', args.get('q'));
    }

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
              content: body.innerText.trim()
            }
          }, {
            mimeType: 'text/html',
            body: {
              content: body.innerHTML
            }
          }],
          headers: [{
            name: 'To',
            value: doc.querySelector('.recipient')?.textContent.replace('To: ', '')
          }, ...o.messages.payload.headers]
        },
        snippet: o.snippet
      }]
    };
  }
  async action(threads, name) {
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
    await this.get(this.base.split('?')['0'] + '?&s=a', '', {
      method: 'POST',
      body
    });
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
    await this.get(this.base.split('?')['0'] + '?&s=a', '', {
      method: 'POST',
      body
    });
    await this.update();
  }
}

export default Engine;
