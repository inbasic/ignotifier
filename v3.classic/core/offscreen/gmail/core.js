/* global get */
'use strict';

const gmail = {};

gmail.fetch = url => new Promise((resolve, reject) => {
  const req = new XMLHttpRequest();
  req.onload = () => resolve({
    text: () => req.response,
    status: req.status
  });
  req.onerror = () => reject(new Error('action -> fetch Error'));
  req.open('GET', url);
  req.send();
});

gmail.random = () => (Math.random().toString(36) + '00000000000000000').slice(2, 14);

{
  const token = {};
  gmail.at = {};
  gmail.at.get = url => {
    url = get.base(url);
    if (token[url]) {
      // invalidate after 10 minutes
      if (Date.now() - token[url].date < 10 * 60 * 1000) {
        return Promise.resolve(token[url]);
      }
    }
    return new Promise((resolve, reject) => {
      const blind = 'https://mail.google.com/mail/?ui=html&zy=h';
      fetch(blind, {
        credentials: 'include'
      }).then(r => r.url).then(href => {
        if (href.indexOf('/u/') === -1) {
          return reject(Error('cannot find basic HTML view from the blind URL'));
        }
        const id = url.split('/u/')[1].split('/')[0];
        const base = href.replace(/\/u\/\d+/, '/u/' + id);

        gmail.fetch(base).then(r => r.text()).then(content => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(content, 'text/html');

          const e = doc.querySelector('a[href*="at="]');
          const input = doc.querySelector('[name="at"]');
          // bypass do you really want to use this view
          if (input) {
            // allow access
            const body = new URLSearchParams();
            body.append('at', input.value);
            fetch(base.split('?')[0] + '?a=uia', {
              method: 'POST',
              body,
              credentials: 'include'
            });

            token[url] = {
              at: input.value,
              base,
              date: Date.now()
            };
            resolve(token[url]);
          }
          else if (e) {
            const args = new URLSearchParams(e.href.split('?')[1]);
            const at = args.get('at');
            if (!at) {
              reject(Error('cannot extract "at" from the base page'));
            }
            token[url] = {
              at,
              base,
              date: Date.now()
            };
            resolve(token[url]);
          }
          else {
            reject(Error('cannot get "at" from the base page'));
          }
        });
      }).catch(reject);
    });
  };
  gmail.at.invalidate = url => delete token[get.base(url)];
}

gmail.formData = obj => {
  const arr = [];
  Object.keys(obj).forEach(key => {
    if (!Array.isArray(obj[key])) {
      obj[key] = [obj[key]];
    }
    obj[key].forEach(v => {
      arr.push(`${key}=${encodeURIComponent(v)}`);
    });
  });
  return arr.join('&');
};

gmail.post = (url, params, threads = [], retry = true, express = false) => new Promise((resolve, reject) => {
  const req = new XMLHttpRequest();
  chrome.storage.local.get({
    inboxRedirection: true,
    express: false
  }, prefs => {
    url = (get.base(url) + '/?' + gmail.formData(params));
    req.open('POST', url);
    req.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    req.onreadystatechange = () => {
      // consider post as successful if req.readyState === HEADERS_RECEIVED
      if (express && prefs.express && req.readyState === 2 && req.status === 200) {
        resolve(req);
      }
    };
    req.onload = () => {
      if (req.status === 302 && retry === true) {
        gmail.at.invalidate(url);
        gmail.post(url, params, threads, retry = false).then(resolve, reject);
      }
      else if (req.status === 404) {
        reject(new Error('Gmail is rejecting this action'));
      }
      else {
        resolve(req);
      }
    };
    req.onerror = e => reject(e);
    req.send(threads.length ? 't=' + threads.join('&t=') : '');
  });
});


gmail.action = ({links, cmd, prefs}) => {
  links = typeof links === 'string' ? [links] : links;
  const url = /[^?]*/.exec(links[0])[0];

  return gmail.at.get(url).then(obj => {
    const threads = links.map(link => get.id(link) || '').map(t => t);

    if (threads.length) {
      const shortcuts = {
        'rd': { // mark as read
          'tact': 'rd',
          'nvp_tbu_go': 'Go',
          'redir': '?&'
        },
        'rd-all': { // mark all as read
          'tact': 'rd',
          'nvp_tbu_go': 'Go'
        },
        'rc_^i': { // archive
          'tact': 'arch',
          'nvp_tbu_go': 'Go'
        },
        'rc_Inbox': { // archive
          'tact': 'arch',
          'nvp_tbu_go': 'Go'
        },
        'tr': { // trash
          'tact': '',
          'nvp_a_tr': 'Delete'
        },
        'move-to-inbox': {
          'tact': '',
          'nvp_a_ib': 'Move to Inbox'
        },
        'sp': { // report spam
          'tact': '',
          'nvp_a_sp': 'Report Spam'
        },
        'rc_Spam': { // report spam
          'tact': '',
          'nvp_a_sp': 'Report Spam'
        },
        'st': { // add-star
          'tact': 'st',
          'nvp_tbu_go': 'Go',
          'bact': ''
        },
        'xst': { // remove star
          'tact': 'xst',
          'nvp_tbu_go': 'Go',
          'bact': ''
        }
      };
      const command = shortcuts[cmd] || {
        'tact': cmd,
        'nvp_tbu_go': 'Go',
        'bact': ''
      };

      const body = new URLSearchParams();
      body.append('at', obj.at);
      for (const [key, value] of Object.entries(command)) {
        body.append(key, value);
      }
      for (const thread of threads) {
        body.append('t', thread);
      }
      body.append('bact', '');

      if (cmd === 'rc_^i' || cmd === 'rc_Inbox') {
        if (prefs.doReadOnArchive === true || prefs.doReadOnArchive === 'true') {
          gmail.action({
            links,
            cmd: 'rd'
          });
        }
      }

      return fetch(obj.base.split('?')['0'] + '?&s=a', {
        method: 'POST',
        body,
        credentials: 'include'
      });
    }
    return Promise.reject(Error('action -> Error at resolving thread.'));
  });
};

gmail.search = async ({url, query}) => {
  const obj = await gmail.at.get(url);
  if (obj.at) {
    const body = new URLSearchParams();
    body.append('s', 'q');
    body.append('q', query);
    body.append('nvp_site_mail', 'Search Mail');
    body.append('at', obj.at);

    const r = await fetch(obj.base.split('?')[0] + '?s=q&q=' + encodeURIComponent(query) + '&nvp_site_mail=Search%20Mail', {
      credentials: 'include'
    });
    const content = await r.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    const as = [...doc.querySelectorAll('a[href*="&th="]')];

    const entries = as.map(a => {
      const ts = a.querySelector('.ts');
      const es = ts.children.length === 3 ? ts.children : ts.childNodes;
      if (es.length < 3) {
        throw Error('Cannot extract "labels", "title", and "snippet" from the element');
      }
      const snippet = ts.querySelector('.ts > font:last-child');

      const entry = {};
      entry.thread = a.href.split('th=')[1].split('&')[0];
      entry.labels = [...es[0].textContent.split(/\s*,\s*/)].filter(a => a);
      if (a.closest('tr').querySelector('img[alt=Starred]')) {
        entry.labels.push('STARRED');
      }
      entry.date = ts.closest('td').nextElementSibling.textContent;
      entry.from = ts.closest('td').previousElementSibling.textContent.replace(/\s+\(\d+\)$/, '');
      entry.text = snippet ? snippet.textContent.replace(/^ - /, '') : '';


      return entry;
    });

    let count = 0;
    if (as.length) {
      const t = doc.querySelector('form[name=f] td[align="right"] b:last-of-type');
      if (!t) {
        throw Error('Cannot detect count');
      }
      count = Number(t.textContent);
    }

    return {
      'count': count || entries.length,
      'name': 'NA',
      'logged-in': true,
      'responseURL': r.responseURL,
      entries
    };
  }
  else {
    throw new Error('Cannot parse search result/1');
  }
};
