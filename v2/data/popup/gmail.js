'use strict';

var gmail = {};

gmail.fetch = url => new Promise((resolve, reject) => {
  const req = new XMLHttpRequest();
  req.onload = () => resolve({
    text: () => req.response
  });
  req.onerror = () => reject(new Error('action -> fetch Error'));
  req.open('GET', url);
  req.send();
});

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

gmail.staticID = (iks => url => {
  if (iks[url]) {
    return Promise.resolve(iks[url]);
  }
  return gmail.fetch(url).then(r => r.text()).then(content => {
    const tmp = /var GLOBALS=\[(?:([^,]*),){10}/.exec(content || '');
    const ik = tmp && tmp.length > 1 ? tmp[1].replace(/["']/g, '') : null;
    if (ik) {
      iks[url] = ik;
      return ik;
    }
    else {
      throw Error(
        'body -> getIK -> ' +
        'Error at resolving user\'s static ID. Please switch back to the summary mode.'
      );
    }
  });
})({});

gmail.body = (contents => (link, mode) => {
  link = link.replace('http://', 'https://');
  if (contents[link]) {
    return Promise.resolve(contents[link]);
  }

  const url = gmail.get.base(link);
  const thread = gmail.get.id(link);

  const rand = Math.random().toString(36).substr(2).padStart(13, '0');
  const oLink = url + `/h/${rand}/?th=${thread}&v=pt`;

  if (!thread) {
    return Promise.reject(Error('body -> Error at resolving thread. Please switch back to the summary mode.'));
  }
  return fetch(oLink, {
    credentials: 'include'
  }).then(r => {
    if (r.ok) {
      return r.text();
    }
    throw Error('cannot use oLink to generate print view');
  }).catch(e => {
    console.error(e);
    return gmail.staticID(url)
      .then(ik => gmail.fetch(url + '?ui=2&ik=' + ik + '&view=pt&dsqt=1&search=all&msg=' + thread).then(r => r.text()));
  }).then(content => {
    const body = gmail.render[mode ? 'getHTMLText' : 'getPlainText'](content, url, link);
    contents[link] = body;
    return body;
  });
})({});

gmail.render = (() => {
  const getLastMessage = content => {
    const html = new DOMParser().parseFromString(content, 'text/html');
    const message = html.documentElement.getElementsByClassName('message');
    try {
      return message[message.length - 1].children[0].children[2];
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
