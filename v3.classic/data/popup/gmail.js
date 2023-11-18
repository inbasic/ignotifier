'use strict';

const gmail = {
  get: {
    base: url => /[^?]*/.exec(url)[0],
    id: url => {
      const tmp = /message_id=([^&]*)/.exec(url);
      if (tmp && tmp.length) {
        return tmp[1];
      }
      return null;
    }
  }
};

gmail.body = (contents => async (link, mode) => {
  link = link.replace('http://', 'https://');
  if (contents[link]) {
    return Promise.resolve(contents[link]);
  }

  const url = gmail.get.base(link);
  const thread = gmail.get.id(link);

  if (!thread) {
    return Promise.reject(Error('body -> Error at resolving thread. Please switch back to the summary mode.'));
  }

  const href = url + '/?ui=2&view=pt&dsqt=1&search=all&msg=' + thread;
  const r = await fetch(href, {
    credentials: 'include'
  });

  if (!r.ok) {
    throw Error('body -> print');
  }
  const content = await r.text();
  const body = gmail.render[mode ? 'getHTMLText' : 'getPlainText'](content, url, link);
  contents[link] = body;
  return body;
})({});

gmail.render = (() => {
  const getLastMessage = content => {
    const html = new DOMParser().parseFromString(content, 'text/html');
    const message = html.documentElement.getElementsByClassName('message');
    try {
      const f = document.createDocumentFragment();
      for (let n = message.length - 1; n >= 0; n -= 1) {
        f.appendChild(message[n].children[0].children[2]);
      }
      return f;
    }
    catch (e) {}
    return '';
  };

  return {
    getHTMLText: content => {
      const body = getLastMessage(content);
      if (body) {
        const table = document.createElement('table');
        table.classList.add('root');
        table.appendChild(body);

        [...table.querySelectorAll('a')].forEach(a => {
          a.dataset.href = a.href;
          a.removeAttribute('href');
        });
        return table;
      }
      else {
        return '';
      }
    },
    getPlainText: content => {
      const body = getLastMessage(content);
      if (body) {
        const span = document.createElement('span');
        span.style['white-space'] = 'pre-line';
        span.textContent = body.innerText;
        return span;
      }
      else {
        return '';
      }
    }
  };
})();
