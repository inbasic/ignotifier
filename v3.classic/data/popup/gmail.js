'use strict';

const gmail = {};

/* gmail.get */
gmail.get = {
  base: url => /[^?]*/.exec(url)[0],
  id: url => {
    const tmp = /message_id=([^&]*)/.exec(url);
    if (tmp && tmp.length) {
      return tmp[1];
    }
    return null;
  }
};

/* gmail.body */
{
  const cache = {};

  gmail.body = (link, mode) => {
    link = link.replace('http://', 'https://');

    if (cache[link]) {
      return Promise.resolve(cache[link]);
    }

    const url = gmail.get.base(link);
    const thread = gmail.get.id(link);

    if (!thread) {
      return Promise.reject(Error('body -> Error at resolving thread. Please switch back to the summary mode.'));
    }

    const href = url + '/?ui=2&view=pt&dsqt=1&search=all&msg=' + thread;

    return fetch(href, {
      credentials: 'include'
    }).then(r => {
      if (!r.ok) {
        throw Error('body -> print failed -> ' + r.status);
      }
      return r.text();
    }).then(content => {
      const body = gmail.render[mode ? 'getHTMLText' : 'getPlainText'](content, url, link);
      cache[link] = body;
      return body;
    });
  };
}

/* gmail.render */
{
  const getLastMessage = content => {
    const doc = new DOMParser().parseFromString(content, 'text/html');

    const m = doc.querySelectorAll('.message > tbody > tr > td:last-child');
    if (m.length) {
      const td = m[m.length - 1];
      for (const a of td.querySelectorAll('a')) {
        if (a.href) {
          // prevent Google redirection
          if (a.href.startsWith('https://www.google.com/url?q=')) {
            try {
              const args = (new URL(a.href)).searchParams;
              a.href = args.get('q') || a.href;
            }
            catch (e) {}
          }
        }
      }
      return td;
    }
    return '';
  };
  gmail.render = {
    getHTMLText(content) {
      const td = getLastMessage(content);
      if (td) {
        const table = document.createElement('table');
        table.classList.add('root');
        const tr = document.createElement('tr');
        table.appendChild(tr);
        tr.appendChild(td);

        return table;
      }
      return '';
    },
    getPlainText(content) {
      const td = getLastMessage(content);
      if (td) {
        const span = document.createElement('span');
        span.style['white-space'] = 'pre-line';
        span.textContent = td.innerText;
        return span;
      }
      return '';
    }
  };
}
