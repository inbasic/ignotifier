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

gmail.random = () => (Math.random().toString(36) + '00000000000000000').slice(2, 14);

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
        return gmail.fetch(url + '/h/' + gmail.random()).then(r => r.text()).then(content => {
          const tmp = /at=([^"&]*)/.exec(content);
          if (tmp && tmp.length > 1) {
            token[url] = tmp[1];
          }
          else {
            token[url] = '';
          }
          return token[url];
        });
      }
    });
  };
  gmail.at.invalidate = url => delete token[gmail.get.base(url)];
}

gmail.formData = (obj, send = false) => {
  const arr = [];
  Object.keys(obj).forEach(key => {
    if (!Array.isArray(obj[key])) {
      obj[key] = [obj[key]];
    }
    if (key !== 'at' || send) {
      obj[key].forEach(v => {
        if (key === 'q' && send) {
          v = v.replace(/\s/, '+');
        }
        arr.push(`${key}=${encodeURIComponent(v)}`);
      });
    }
  });
  return arr.join('&');
};

gmail.post = (url, data, retry = true) => new Promise((resolve, reject) => {
  url = (gmail.get.base(url) + '/h/' + gmail.random() + '/?&' + gmail.formData(data));

  const req = new XMLHttpRequest();
  req.open('POST', url);
  req.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
  req.onload = () => {
    gmail.at.get(url).then(at => {
      // is token changed
      if (req.response.indexOf('at=' + at) === -1 && retry === true) {
        gmail.at.invalidate(url);
        gmail.at.get(url).then(at => {
          data.at = at;
          gmail.post(url, data, false).then(resolve, reject).then(resolve, reject);
        }).catch(reject);
      }
      else {
        resolve(req);
      }
    });
  };
  req.onerror = e => reject('');
  const c = gmail.formData(data, true);
  req.send(c);
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
    const data = {
      at,
      t: threads,
      cat: '',
      tact: cmd,
      'nvp_tbu_go': 'Go'
    };
    if (cmd === 'rd-all') {
      delete data.cat;
      delete data['nvp_tbu_go'];
      data['nvp_a_arch'] = 'Archive';
    }
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
  return gmail.post(url, {
    s: 'q',
    q: query,
    'nvp_site_mail': 'Search Mail',
    at
  });
});
