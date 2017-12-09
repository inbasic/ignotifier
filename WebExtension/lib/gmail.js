'use strict';

var gmail = {};

/*gmail.fetch = url => fetch(url, {
  credentials: 'same-origin',
  mode: 'cors',
  headers:{
    'Access-Control-Allow-Origin': '*'
  }
}).then(r => {
  console.log(url, r);
  if (r.ok) {
    return r;
  }
  throw Error('action -> fetch Error');
});*/
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

gmail.action = (token => {
  function getAt(url) {
    if (token[url]) {
      return Promise.resolve(token[url]);
    }
    return gmail.fetch(url).then(r => r.text()).then(content => {
      const tmp = /GM_ACTION_TOKEN="([^"]*)"/.exec(content);
      if (tmp && tmp.length) {
        token[url] = tmp[1];
        return token[url];
      }
      else {
        return gmail.fetch(url + 'h/' + Math.ceil(1000000 * Math.random())).then(r => r.text()).then(content => {
          const tmp = /at=([^"&]*)/.exec(content);
          if (tmp && tmp.length > 1) {
            token[url] = tmp[1];
          }
          return token[url];
        });
      }
    });
  }

  function sendCmd(url, at, threads, cmd) {
    if (cmd === 'rc_%5Ei') {
      // mark as read on archive
      chrome.storage.local.get({
        doReadOnArchive: false
      }, prefs => {
        if (prefs.doReadOnArchive === true || prefs.doReadOnArchive === 'true') {
          sendCmd(url, at, threads, 'rd');
        }
      });
    }
    return gmail.fetch(url + '&at=' + at + '&act=' + cmd.replace('rd-all', 'rd') + '&t=' + threads.join('&t=')).then(r => {
      if (r.status === 500) {
        token = {};
        return 'retry';
      }
    });
  }

  return ({links, cmd}) => {
    links = typeof links === 'string' ? [links] : links;
    let url = /[^?]*/.exec(links[0])[0];

    const perform = () => getAt(url).then(function(at) {
      if (!at) {
        return Promise.reject(new Error('action -> Cannot resolve GM_ACTION_TOKEN'));
      }
      const threads = links.map(link => gmail.get.id(link) || '').map(t => t);

      let second = false;
      if (threads.length) {
        return sendCmd(url, at, threads, cmd).then(r => {
          if (r === 'retry' && second === false) {
            second = true;
            return perform();
          }
        });
      }
      return Promise.reject(Error('action -> Error at resolving thread.'));
    });

    return new Promise((resolve, reject) => chrome.storage.local.get({
      inboxRedirection: true
    }, prefs => {
      if (prefs.inboxRedirection) {
        url += '/?ibxr=0';
      }
      perform().then(resolve, reject);
    }));
  };
})({});
