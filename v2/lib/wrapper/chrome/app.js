/* globals config, chrome */
'use strict';

var isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
var isOpera = navigator.userAgent.indexOf('OPR') !== -1;

var EventEmitter = function() {
  this.callbacks = {};
};
EventEmitter.prototype.on = function(name, callback) {
  this.callbacks[name] = this.callbacks[name] || [];
  this.callbacks[name].push(callback);
};
EventEmitter.prototype.emit = function(name, data) {
  (this.callbacks[name] || []).forEach(c => c(data));
};

var app = new EventEmitter();
var userActions = [];

app.actions = c => userActions.push(c);

chrome.notifications.onClicked.addListener(function(id) {
  chrome.notifications.clear(id, function() {});
  userActions.forEach(c => c());
  if (app.notify[id]) {
    app.notify[id]();
  }
});
if (chrome.notifications.onButtonClicked) {
  chrome.notifications.onButtonClicked.addListener((id, index) => {
    chrome.notifications.clear(id, function() {});
    userActions.forEach(c => c());
    if (app.notify[id] && app.notify[id].buttons) {
      app.notify[id].buttons[index].callback();
    }
  });
}

app.popup = {
  attach: () => chrome.browserAction.setPopup({
    popup: '/data/popup/index.html'
  }),
  detach: () => {
    const popup = chrome.extension.getViews({type:'popup'})[0];
    if (popup) {
      popup.close();
    }
    chrome.browserAction.setPopup({
      popup: ''
    });
  },
  send: (id, data) => chrome.runtime.sendMessage({method: id, data: data})
};

app.get = (url, headers = {}, data, timeout) => new Promise(resolve => {
  const req = new XMLHttpRequest();
  req.onreadystatechange = () => req.readyState === 4 && resolve(req);

  req.open(data ? 'POST' : 'GET', url, true);
  for (const id in headers) {
    req.setRequestHeader(id, headers[id]);
  }
  if (data) {
    const arr = [];
    for (const e in data) {
      arr.push(e + '=' + data[e]);
    }
    data = arr.join('&');
  }
  req.timeout = timeout;
  req.send(data ? data : '');
});

app.l10n = chrome.i18n.getMessage;

app.notify = function(text, title, callback, buttons = []) {
  title = title || app.l10n('gmail');
  if (config.notification.silent) {
    return;
  }
  var isArray = Array.isArray(text);
  if (isArray && text.length === 1) {
    isArray = false;
    text = text[0];
  }
  if (isOpera && isArray) {
    isArray = false;
    text = text.join('\n');
  }

  const options = {
    type: isArray ? 'list' : 'basic',
    iconUrl: '/data/icons/notification/48.png',
    title,
    message: isArray ? '' : text,
    priority: 2,
    eventTime: Date.now() + 30000,
    items: isArray ? text.map(function(message) {
      var tmp = message.split('\n');
      return {
        title: (tmp[1] || '').replace('Title: ', ''),
        message: tmp[0].replace('From: ', '')
      };
    }) : [],
    isClickable: true,
    requireInteraction: true,
    buttons: buttons.map(b => ({
      title: b.title,
      iconUrl: b.iconUrl
    }))
  };
  if (isFirefox) {
    delete options.requireInteraction;
    delete options.buttons;
  }
  if (isOpera) {
    delete options.buttons;
  }
  if (config.notification.actions === false) {
    delete options.buttons;
  }

  chrome.notifications.create(null, options, id => {
    app.notify[id] = callback;
    if (callback) {
      app.notify[id].buttons = buttons;
    }
    window.setTimeout(id => {
      app.notify[id] = null;
      chrome.notifications.clear(id);
    }, config.notification.time * 1000, id);
  });
};

app.sound = (function() {
  var audio = document.createElement('audio');
  audio.setAttribute('preload', 'auto');
  audio.setAttribute('autobuffer', 'true');

  return {
    play: function(index) {
      if (config.notification.silent) {
        return;
      }
      const sound = config.notification.sound;
      const type = index === null ? sound.media.default.type : sound.media['custom' + index].type;
      var path = '/data/sounds/' + type + '.wav';
      if (type === 4) {
        path = index === null ? sound.media.default.file : sound.media['custom' + index].file;
      }
      audio.src = path;
      audio.volume = sound.volume / 100;
      audio.play();
    },
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
    }
  };
})();

/* updating badge when action is posted */
{
  let id;
  chrome.webRequest.onCompleted.addListener(d => {
    if (d.tabId) {
      if (
        d.type === 'main_frame' ||
        d.url.indexOf('&act=') !== -1 ||
        (d.url.indexOf('/sync/u/') !== -1 && d.method === 'POST')
      ) {
        window.clearTimeout(id);
        id = window.setTimeout(() => {
          app.emit('update');
        }, 2000);
      }
    }
  },
    {urls: [
      '*://mail.google.com/mail/u*',
      '*://mail.google.com/sync/u/*/i/s*'
    ]},
    []
  );
}

app.isPrivate = () => false;
