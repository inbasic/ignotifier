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
  base: url => /[^?]*/.exec(url)[0].split('/h')[0].replace(/\/$/, ''),
  id: url => {
    const tmp = /message_id=([^&]*)/.exec(url);
    if (tmp && tmp.length) {
      return tmp[1];
    }
    return null;
  }
};

{
  const token = {};
  gmail.at = {};
  gmail.at.get = url => {
    url = gmail.get.base(url);
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
  };
  gmail.at.invalidate = url => delete token[gmail.get.base(url)];
}

gmail.post = (url, data, retry = true) => new Promise((resolve, reject) => {
  const rand = (Math.random().toString(36) + '00000000000000000').slice(2, 14);
  url = (gmail.get.base(url) + '/h/' + rand + '/?&s=q');
  const req = new XMLHttpRequest();
  req.open('POST', url);
  req.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
  req.onload = () => {
    gmail.at.get(url).then(at => {
      // is token changed
      if (req.response.indexOf('at=' + at) === -1 && retry === true) {
        gmail.at.invalidate(url);
        gmail.at.get(url).then(at => {
          data = data.replace(/at=[^&]*/, 'at=' + at);
          gmail.post(url, data, false).then(resolve, reject).then(resolve, reject);
        }).catch(reject);
      }
      else {
        resolve(req);
      }
    });
  };
  req.onerror = () => reject('');

  req.send(data);
});

{
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
    const data = 'at=' + at + '&t=' + threads.join('&t=') + '&cat=&tact=' + cmd + '&nvp_tbu_go=Go';
    return gmail.post(url, data);
  }

  gmail.action = ({links, cmd}) => {
    if (cmd === 'rc_Inbox') {
      cmd = 'rc_^i';
    }
    else if (cmd === 'rc_Spam') {
      cmd = 'us';
    }
    links = typeof links === 'string' ? [links] : links;
    let url = /[^?]*/.exec(links[0])[0];

    const perform = () => gmail.at.get(url).then(at => {
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
}

gmail.search = ({url, query}) => gmail.at.get(url).then(at => {
  if (!at) {
    return Promise.reject(new Error('search -> Cannot resolve GM_ACTION_TOKEN'));
  }
  const data = `s=q&q=${encodeURIComponent(query)}&nvp_site_mail=Search%20Mail&at=${at}`;
  return gmail.post(url, data);
});
