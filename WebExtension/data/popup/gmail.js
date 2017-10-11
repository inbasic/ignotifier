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
    return gmail.fetch(url + '&at=' + at + '&act=' + cmd.replace('rd-all', 'rd') + '&t=' + threads.join('&t='));
  }

  return (links, cmd) => {
    links = typeof links === 'string' ? [links] : links;
    const url = /[^?]*/.exec(links[0])[0] + '/?ibxr=0';
    return getAt(url).then(function(at) {
      if (!at) {
        return Promise.reject(new Error('action -> Cannot resolve GM_ACTION_TOKEN'));
      }
      const threads = links.map(link => gmail.get.id(link) || '').map(t => t);

      if (threads.length) {
        return sendCmd(url, at, threads, cmd);
      }
      return Promise.reject(Error('action -> Error at resolving thread.'));
    });
  };
})({});

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
  console.log(link, mode)
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
      const body = gmail.render[mode === 1 ? 'getHTMLText' : 'getPlainText'](content, url, link);
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
      return body ?
        body.innerHTML
          .replace(/src="\/mail\/u\//g, 'src="https://mail.google.com/mail/u/')
          .replace(/\?ui=2&/g, link + '?ui=2&')
          .replace(/<u\/>/g, '')
          .replace('[Quoted text hidden]', '<a href="' + feed + '">[Quoted text hidden]</a>') :
        content;
    },
    getPlainText: content => {
      const body = getLastMessage(content) || '...';

      const normalize = a => {
        if (!a) {
          return '';
        }
        return a
          .replace(/ +/g, ' ')
          .replace(/[\t]+/gm, '')
          .replace(/[ ]+$/gm, '')
          .replace(/^[ ]+/gm, '')
          .replace(/\n{2,}/g, '\n\n')
          .replace(/\n+$/, '')
          .replace(/^\n+/, '')
          .replace(/\nNEWLINE\n/g, '\n\n')
          .replace(/NEWLINE\n/g, '\n\n')
          .replace(/NEWLINE/g, '\n');
      };
      const removeWhiteSpace = node => {
        const isWhite = node => !(/[^\t\n\r ]/.test(node.nodeValue));
        const ws = [];
        const findWhite = node => {
          for (let i = 0; i < node.childNodes.length; i++) {
            const n = node.childNodes[i];
            if (n.nodeType === 3 && isWhite(n)) {
              ws.push(n);
            }
            else if (n.hasChildNodes()) {
              findWhite(n);
            }
          }
        };
        findWhite(node);
        for (let i = 0; i < ws.length; i++) {
          ws[i].parentNode.removeChild(ws[i]);
        }
      };
      const sty = (n, prop) => {
        const s = n.currentStyle || window.getComputedStyle(n, null);
        if (n.tagName === 'SCRIPT') {
          return 'none';
        }
        if (!s[prop]) {
          return 'LI,P,TR'.indexOf(n.tagName) > -1 ? 'block' : n.style[prop];
        }
        if (s[prop] === 'block' && n.tagName === 'TD') {
          return 'feaux-inline';
        }
        return s[prop];
      };

      const blockTypeNodes = 'table-row,block,list-item';
      const isBlock = n => {
        const s = sty(n, 'display') || 'feaux-inline';
        if (blockTypeNodes.indexOf(s) > -1) {
          return true;
        }
        return false;
      };
      const recurse = n => {
        let t = '';
        if (/pre/.test(sty(n, 'whiteSpace'))) {
          t += n.innerHTML
            .replace(/\t/g, ' ')
            .replace(/\n/g, ' ');
          return '';
        }
        const s = sty(n, 'display');
        if (s === 'none') {
          return '';
        }
        const gap = isBlock(n) ? '\n' : ' ';

        t += gap;
        for (let i = 0; i < n.childNodes.length; i++) {
          const c = n.childNodes[i];
          if (c.localName === 'a' && c.href && c.textContent) {
            t += "<a href='" + c.href + "'>" + c.textContent + '</a>';
          }
          else if (c.nodeType === 3) {
            t += c.nodeValue;
          }
          else if (c.childNodes.length) {
            recurse(c);
          }
        }
        t += gap;
        t = t.replace(/(<[^>^<]+>)/ig, function(s) { //Strip HTML tags
          return s.indexOf('<a href') !== -1 || s.indexOf('</a>') !== -1 ? s : s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        });
        return t;
      };
      const node = body.cloneNode(true);
      node.innerHTML = node.innerHTML.replace(/<br>/g, '\n');
      const paras = node.getElementsByTagName('p');
      for (let i = 0; i < paras.length; i++) {
        paras[i].innerHTML += 'NEWLINE';
      }

      removeWhiteSpace(node);

      return normalize(recurse(node))
        .replace(/^\s\s*/, '').replace(/\s\s*$/, '')
        .replace(/\n\s{2,}\n/g, '\n\n')
        .replace(/\n/g, '<br>');
    }
  };
})();
