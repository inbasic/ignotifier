/* globals gmail, locale, utils */
'use strict';

var objs;
var contentCache = [];
var selected = {};
var api = {
  callbacks: {}
};
api.on = function(name, callback) {
  api.callbacks[name] = api.callbacks[name] || [];
  api.callbacks[name].push(callback);
};
api.emit = function(name, data) {
  (api.callbacks[name] || []).forEach(c => c(data));
};
chrome.storage.local.get({
  'plug-in/labels': true
}, prefs => {
  if (prefs['plug-in/labels']) {
    document.body.appendChild(Object.assign(document.createElement('script'), {
      src: 'plug-ins/labels.js'
    }));
  }
});

var notify = msg => chrome.notifications.create(null, {
  type: 'basic',
  iconUrl: '/data/icons/notification/48.png',
  title: chrome.i18n.getMessage('gmail'),
  message: msg.message || msg
});

var qs = function(q, m) {
  var reserved = {
    'stats': 'header div[name="stat"] b',
    'accounts': '#accounts',
    'content': '#content',
    'expand': '#expand',
    'date': '#content div[name="date"]',
    'email': '#content div[name="email"]',
    'sender': '#content div[name="sender"] a',
    'title': '#content div[name="title"] a',
    'next': 'header div div:nth-child(2)',
    'previous': 'header div div:nth-child(1)',
    'archive': 'footer div[name="archive"]',
    'spam': 'footer div[name="spam"]',
    'settings': 'footer div[name="settings"]',
    'gmail': 'footer div[name="gmail"]',
    'trash': 'footer div[name="trash"]',
    'refresh': 'footer div[name="refresh"]',
    'read': 'footer div[name="read"]',
    'read-all': 'footer div[name="read-all"]',
    'email-container': 'header div[name="email-container"]',
    'iframe': '#content iframe'
  };
  q = reserved[q] || q;
  qs.cache = qs.cache || [];
  qs.cache[q] = qs.cache[q] || document[m ? 'querySelectorAll' : 'querySelector'](q);
  return qs.cache[q];
};

var html = (() => {
  // List of all used elements
  const li = document.createElement('li');

  function addContent(elem, txt) {
    if (txt) {
      elem.textContent = txt;
    }
    return elem;
  }
  return function(tag, txt) {
    var tmp;
    switch (tag) {
      case 'li':
        tmp = li.cloneNode(false);
        break;
      default:
        tmp = document.createElement(tag);
    }
    return addContent(tmp, txt);
  };
})();
/** objects **/
var accountSelector = (() => {
  const tmp = qs('email-container');
  return {
    get text() {
      return tmp.textContent;
    },
    set text(val) {
      localStorage.setItem('last-account', val);
      tmp.textContent = val;
    },
    gen: xml => xml.title + (xml.label ? ' [' + xml.label + ']' : '')
  };
})();
var stat = (() => {
  const list = qs('stats', true);
  return {
    get current() {
      return list[0].textContent;
    },
    set current(val) {
      list[0].textContent = val;
    },
    get total() {
      return list[1].textContent;
    },
    set total(val) {
      list[1].textContent = val;
    }
  };
})();
var body = (function() {
  var date = qs('date');
  var email = qs('email');
  var name = qs('sender');
  var title = qs('title');
  return {
    get date() {
      return date.textContent;
    },
    set date(val) {
      date.textContent = val;
    },
    get email() {
      return email.textContent;
    },
    set email(val) {
      email.textContent = val;
    },
    get name() {
      return name.textContent;
    },
    set name(val) {
      name.textContent = val;
    },
    set nameLink(val) {
      name.setAttribute('href', val);
    }, get title() {
      return title.textContent;
    },
    set title(val) {
      title.textContent = val || locale.get('popup_no_subject');
    },
    set titleLink(val) {
      title.setAttribute('href', val);
    }
  };
})();

/** Update UI if necessary **/
var update = (() => {
  const old = {
    link: null,
    id: null,
    count: null
  };
  let index;
  return (previous, next) => {
    // Make sure the selected entry is still available
    const isAvailable = objs.reduce((p, c) => p.concat(c.xml.entries), [])
      .reduce((p, c) => p || selected.entry && c.id === selected.entry.id, false);
    if (isAvailable) { // Even if the selected entry is available still the parent might have been changed
      selected.parent = objs.filter(o => o.xml.link === selected.parent.xml.link)[0];
    }
    else {
      // does the old account still have unread entries?
      const obj = objs.filter(o => selected.parent && o.xml.link === selected.parent.xml.link);
      if (obj.length && obj[0].xml.fullcount) {
        selected.entry = obj[0].xml.entries[Math.min(obj[0].xml.entries.length - 1, index)];
        selected.parent = obj[0];
      }
      else {
        selected.parent = objs.reduce((p, c) => c.xml.fullcount ? c : p);
        selected.entry = selected.parent.xml.entries[0];
      }
    }
    if (!selected.parent) {
      return;
    }
    // updating current index
    selected.parent.xml.entries.forEach((entry, i) => {
      if (entry.id === selected.entry.id) {
        if (index !== i) {
          index = i;
          // Although body is updated but index is not
          stat.current = index + 1;
        }
      }
    });

    // Is previous or next requested
    if (previous && index > 0) {
      index -= 1;
      selected.entry = selected.parent.xml.entries[index];
    }
    if (next && selected.parent.xml.entries.length - 1 > index) {
      index += 1;
      selected.entry = selected.parent.xml.entries[index];
    }

    // What parts need update
    const doAccountSelector = old.link !== selected.parent.xml.link;
    const doAccountBody = old.id !== selected.entry.id;
    const doNumber = old.count !== selected.parent.xml.fullcount;
    const doPrevious = index !== 0;
    const doNext = index !== selected.parent.xml.entries.length - 1;

    if (doAccountSelector) {
      old.link = selected.parent.xml.link;
      accountSelector.text = accountSelector.gen(selected.parent.xml);
    }
    if (doAccountBody) {
      old.id = selected.entry.id;

      const base = gmail.get.base(selected.entry.link);
      const messageID = gmail.get.id(selected.entry.link);
      stat.current = index + 1;
      body.title = selected.entry.title;
      if (messageID && selected.parent.xml.link.indexOf('#') === -1) {
        body.titleLink = base + '/?shva=1#inbox/' + messageID;
      }
      else if (messageID) {
        body.titleLink = selected.parent.xml.link + '/' + messageID;
      }
      else {
        body.titleLink = selected.entry.link;
      }

      body.name = selected.entry.author_name;
      // body.nameLink = base + "?view=cm&fs=1&tf=1&to=" + selected.entry.author_email;
      body.nameLink = 'mailto:' + selected.entry.author_email + '?subject=Re: ' + selected.entry.title;
      body.email = '<' + selected.entry.author_email + '>';
      updateContent();
    }
    if (doNumber) {
      old.count = selected.parent.xml.fullcount;
      stat.total = selected.parent.xml.fullcount;
    }
    if (doPrevious) {
      qs('previous').removeAttribute('disabled');
    }
    else {
      qs('previous').setAttribute('disabled', true);
    }
    if (doNext) {
      qs('next').removeAttribute('disabled');
    }
    else {
      qs('next').setAttribute('disabled', true);
    }
    body.date = utils.prettyDate(selected.entry.modified);
  };
})();

/* Listeners */
var Listen = function(query, on, callback, pointer) {
  const elem = qs(query);
  elem.addEventListener(on, function(e) {
    if (elem.getAttribute('disabled') === 'true') {
      return;
    }
    if (callback) {
      callback.apply(pointer, [e]);
    }
  }, false);
};

new Listen('email-container', 'click', function(e) {
  // Clear old list
  qs('accounts').textContent = '';
  // Add new items (remove no-unread accounts first)
  objs.filter(o => o.xml.fullcount)
    .map(o => [o.xml.title + (o.xml.label ? ' [' + o.xml.label + ']' : ''), o.xml.link])
    .forEach(arr => {
      const li = html('li', arr[0]);
      li.setAttribute('value', arr[1]);
      li.setAttribute('class', 'ellipsis');

      if (selected.entry && arr[1] === selected.parent.xml.link) {
        li.classList.add('selected');
      }
      qs('accounts').appendChild(li);
    });
  // Show menu
  qs('accounts').style.display = 'block';
  e.stopPropagation();

  window.addEventListener('click', function _() {
    qs('accounts').style.display = 'none';
    window.removeEventListener('click', _);
  }, false);
});
new Listen('accounts', 'click', ({target}) => {
  const link = target.getAttribute('value');
  if (selected.parent.xml.link !== link) {
    const obj = objs.reduce((p, c) => c.xml.link === link ? c : p);
    selected.entry = obj.xml.entries[0];
    selected.parent = obj;
    update();
  }
});
new Listen('next', 'click', () => update(false, true));
new Listen('previous', 'click', () => update(true, false));

var action = (cmd, links = selected.entry.link, callback = () => {}) => {
  chrome.runtime.sendMessage({
    method: 'gmail.action',
    cmd,
    links
  }, e => {
    callback();
    if (cmd === 'rd') {
      qs('read').textContent = locale.get('popup_read');
      qs('read').removeAttribute('disabled');
    }
    else {
      let obj;
      switch (cmd) {
      case 'rd':
        obj = qs('read');
        break;
      case 'rd-all':
        obj = qs('read-all');
        break;
      case 'tr':
        obj = qs('trash');
        break;
      case 'rc_^i':
        obj = qs('archive');
        break;
      case 'sp':
        obj = qs('spam');
        break;
      }
      if (obj) {
        obj.removeAttribute('wait');
        obj.removeAttribute('disabled');
      }
    }
    chrome.runtime.sendMessage({
      method: 'update'
    });
  });
};

new Listen('archive', 'click', () => {
  qs('archive').setAttribute('wait', true);
  qs('archive').setAttribute('disabled', true);
  action('rc_^i');
});
new Listen('trash', 'click', () => {
  qs('trash').setAttribute('wait', true);
  qs('trash').setAttribute('disabled', true);
  action('tr');
});
new Listen('spam', 'click', () => {
  qs('spam').setAttribute('wait', true);
  qs('spam').setAttribute('disabled', true);
  action('sp');
});
new Listen('read', 'click', () => {
  qs('read').textContent = locale.get('popup_wait');
  qs('read').setAttribute('disabled', true);
  action('rd');
});
new Listen('refresh', 'click', () => chrome.runtime.sendMessage({
  method: 'update',
  forced: true
}));
new Listen('gmail', 'click', () => chrome.runtime.sendMessage({
  method: 'open',
  url: selected.parent.xml.link
}, () => window.close()));
new Listen('settings', 'click', () => chrome.tabs.update({
  url: '/data/options/index.html'
}, () => window.close()));
new Listen('read-all', 'click', () => {
  qs('read-all').setAttribute('wait', true);
  qs('read-all').setAttribute('disabled', true);
  action('rd-all', selected.parent.xml.entries.map(e => e.link));
});

new Listen('expand', 'click', () => chrome.storage.local.set({
  size: qs('body').getAttribute('mode') === 'expanded' ? 0 : 1
}));

function updateContent() {
  const doSummary = () => {
    if (selected.entry) {
      qs('iframe').contentDocument.body.textContent = selected.entry.summary + ' ...';
    }
  };

  if (selected.entry) {
    localStorage.setItem('last-id', selected.entry.id);
  }

  const mode = qs('body').getAttribute('mode') === 'expanded' ? 1 : 0;
  if (mode === 1) {
    const link = selected.entry.link;
    const content = contentCache[link];
    api.emit('update-full-content', link);
    if (content) {
      qs('content').removeAttribute('loading');
      if (content) {
        qs('iframe').contentDocument.querySelector('head base').href = link;
        qs('iframe').contentDocument.body.textContent = '';
        qs('iframe').contentDocument.body.appendChild(content);
      }
    }
    else {
      doSummary();
      qs('content').setAttribute('loading', 'true');
      chrome.storage.local.get({
        render: true
      }, prefs => gmail.body(link, prefs.render).then(content => {
        if (link === selected.entry.link) {
          // For chat conversations, there is no full content mode
          if (content) {
            contentCache[link] = content;
            updateContent();
          }
          else {
            qs('content').removeAttribute('loading');
          }
        }
      }).catch(notify));
    }
  }
  else {
    doSummary();
  }
}

// resize
const resize = () => {
  chrome.storage.local.get({
    fullWidth: 750,
    fullHeight: 600,
    size: 0
  }, prefs => {
    const expanded = prefs.size === 1 || prefs.size === '1';
    if (expanded) {
      document.body.setAttribute('mode', 'expanded');
    }
    else {
      document.body.removeAttribute('mode');
      qs('content').removeAttribute('loading');
    }
    if (selected.entry) {
      updateContent();
    }
    const normal = {
      width: 500,
      height: 240
    };
    Object.assign(document.body.style, {
      width: (expanded ? prefs.fullWidth : normal.width) + 'px',
      height: (expanded ? prefs.fullHeight - 20 : normal.height) + 'px'
    });
  });
  // Close account selection menu if it is open
  qs('accounts').style.display = 'none';
};
resize();
chrome.storage.onChanged.addListener(prefs => {
  if (prefs.size || prefs.fullWidth || prefs.fullHeight) {
    resize();
  }
});

// communication
chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'validate-current') {
    if (selected.parent.xml.fullcount === 20) {
      objs = request.data;
      update();
    }
  }
  else if (request.method === 'update') {
    objs = request.data;
    update();
  }
  else if (request.method === 'update-date') {
    // This function is called on every server response.
    if (!selected.entry) {
      return;
    }
    body.date = utils.prettyDate(selected.entry.modified);
  }
});

// init
qs('iframe').addEventListener('load', () => chrome.runtime.getBackgroundPage(b => {
  objs = b.checkEmails.getCached();
  if (objs && objs.length) {
    // Selected account
    const unreadEntries = objs.map(obj => obj.xml.entries
      .filter(e => obj.newIDs.indexOf(e.id) !== -1))
      .reduce((p, c) => p.concat(c), []);
    // selecting the correct account
    if (unreadEntries.length) {
      const newestEntry = unreadEntries.sort((p, c) => {
        const d1 = new Date(p.modified);
        const d2 = new Date(c.modified);
        return d1 < d2;
      })[0];
      selected.entry = newestEntry;
      selected.parent = objs.reduce((p, c) => c.xml.entries.indexOf(newestEntry) !== -1 ? c : p);
    }
    if (!selected.entry) {
      const lastAccount = localStorage.getItem('last-account');
      if (lastAccount) {
        const account = objs.filter(o => accountSelector.gen(o.xml) === lastAccount).shift();
        if (account) {
          const id = localStorage.getItem('last-id');
          selected = {
            entry: [
              ...account.xml.entries.filter(e => e.id === id),
              account.xml.entries[0]
            ].shift(),
            parent: account
          };
          return update();
        }
      }
    }
    selected = {
      entry: objs[0].xml.entries[0],
      parent: objs[0]
    };
    update();
  }
}));
