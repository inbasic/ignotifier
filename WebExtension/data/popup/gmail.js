'use strict';

var gmail = {};

gmail.fetch = url => fetch(url, {credentials: 'same-origin'}).then(r => {
  if (r.ok) {
    return r;
  }
  throw Error('action -> fetch Error');
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

  const url = /[^?]*/.exec(link)[0] + '/?ibxr=0';
  const thread = gmail.get.id(link);

  if (!thread) {
    return Promise.reject(Error('body -> Error at resolving thread. Please switch back to the summary mode.'));
  }
  return gmail.staticID(url)
    .then(ik => gmail.fetch(url + '&ui=2&ik=' + ik + '&view=pt&dsqt=1&search=all&msg=' + thread)
    .then(r => r.text())
    .then(content => {
      const body = gmail.render[mode ? 'getHTMLText' : 'getPlainText'](content, url, link);
      contents[link] = body;
      return body;
    }));
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
    getHTMLText: (content, link, feed) => {
      const body = getLastMessage(content);
      if (body) {
        const table = document.createElement('table');
        table.classList.add('root');
        table.appendChild(body);
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
