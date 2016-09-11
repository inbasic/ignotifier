/* globals config, chrome, webkitNotifications */
'use strict';

var app = new EventEmitter();

app.once('load', function () {
  var script = document.createElement('script');
  document.body.appendChild(script);
  script.src = '../../common.js';
});

/* exports */
if (!Promise.defer) {
  Promise.defer = function () {
    var deferred = {};
    var promise = new Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject  = reject;
    });
    deferred.promise = promise;
    return deferred;
  };
}
app.Promise = Promise;

app.button = (function () {
  var callback;
  var onContext;
  var ids = {childs: []};
  chrome.browserAction.onClicked.addListener(function () {
    if (callback) {
      callback();
    }
  });

  return {
    onCommand: function (c) {
      callback = c;
    },
    onContext: function (c) {
      onContext = c;
      ids.root = chrome.contextMenus.create({
        title: app.l10n('label_14'),
        contexts: ['browser_action'],
        enabled: false
      });
      ids.disable = chrome.contextMenus.create({
        title: app.l10n('label_3'),
        contexts: ['browser_action']
      });
      chrome.contextMenus.create({
        parentId: ids.disable,
        title: app.l10n('label_4'),
        contexts: ['browser_action'],
        onclick: function () {
          onContext.silent(300);
        }
      });
      chrome.contextMenus.create({
        parentId: ids.disable,
        title: app.l10n('label_5'),
        contexts: ['browser_action'],
        onclick: function () {
          onContext.silent(900);
        }
      });
      chrome.contextMenus.create({
        parentId: ids.disable,
        title: app.l10n('label_6'),
        contexts: ['browser_action'],
        onclick: function () {
          onContext.silent(1800);
        }
      });
      chrome.contextMenus.create({
        parentId: ids.disable,
        title: app.l10n('label_7'),
        contexts: ['browser_action'],
        onclick: function () {
          onContext.silent(3600);
        }
      });
      chrome.contextMenus.create({
        parentId: ids.disable,
        title: app.l10n('label_8'),
        contexts: ['browser_action'],
        onclick: function () {
          onContext.silent(7200);
        }
      });
      chrome.contextMenus.create({
        parentId: ids.disable,
        title: app.l10n('label_9'),
        contexts: ['browser_action'],
        onclick: function () {
          onContext.silent(18000);
        }
      });
      chrome.contextMenus.create({
        parentId: ids.disable,
        title: app.l10n('label_13'),
        contexts: ['browser_action'],
        onclick: function () {
          onContext.silent('custom');
        }
      });
      ids.silent = chrome.contextMenus.create({
        title: app.l10n('label_10'),
        type: 'checkbox',
        checked: onContext.state,
        contexts: ['browser_action'],
        onclick: function () {
          onContext.silent();
        }
      });
      chrome.contextMenus.create({
        title: app.l10n('label_11'),
        contexts: ['browser_action'],
        onclick: onContext.compose
      });
      chrome.contextMenus.create({
        title: app.l10n('label_1'),
        contexts: ['browser_action'],
        onclick: onContext.refresh
      });
      chrome.contextMenus.create({
        title: app.l10n('label_12'),
        contexts: ['browser_action'],
        onclick: onContext.faq
      });
    },
    fireContext: function () {
      ids.childs.forEach(function (obj) {
        chrome.contextMenus.remove(obj.id);
      });
      ids.childs = [];
      var accounts = onContext.accounts;
      accounts.forEach(function (obj) {
        ids.childs.push({
          name: obj.name,
          id: chrome.contextMenus.create({
            parentId: ids.root,
            contexts: ['browser_action'],
            title: obj.label,
            onclick: obj.command
          })
        });
      });
      chrome.contextMenus.update(ids.root, {
        enabled: accounts.length !== 0
      });
    },
    onState: function () {
      chrome.contextMenus.update(ids.silent, {
        checked: onContext.state
      });
    },
    onClick: function () {},
    set label (val) { // jshint ignore:line
      chrome.browserAction.setTitle({
        title: val
      });
    },
    set badge (val) { // jshint ignore:line
      chrome.browserAction.setBadgeText({
        text: (val ? val : '') + ''
      });
    },
    set color (val) { // jshint ignore:line
      chrome.browserAction.setIcon({
        path: '../../../data/icons/' + val + '/19.png'
      });
    }
  };
})();

app.popup = (function () {
  return {
    show: function () { },
    hide: function () {
      var popup = chrome.extension.getViews({type:'popup'})[0];
      if (popup) {
        popup.close();
      }
    },
    attach: function () {
      chrome.browserAction.setPopup({
        popup: 'data/popup/index.html'
      });
    },
    detach: function () {
      this.hide();
      chrome.browserAction.setPopup({
        popup: ''
      });
    },
    send: function (id, data) {
      chrome.extension.sendRequest({method: id, data: data});
    },
    receive: function (id, callback) {
      chrome.extension.onRequest.addListener(function (request, sender) {
        if (request.method === id && !sender.tab) {
          callback(request.data);
        }
      });
    }
  };
})();

app.timer = window;

app.get = function (url, headers, data, timeout) {
  headers = headers || {};

  var xhr = new XMLHttpRequest();
  var d = app.Promise.defer();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      d.resolve(xhr);
    }
  };
  xhr.open(data ? 'POST' : 'GET', url, true);
  for (var id in headers) {
    xhr.setRequestHeader(id, headers[id]);
  }
  if (data) {
    var arr = [];
    for (var e in data) {
      arr.push(e + '=' + data[e]);
    }
    data = arr.join('&');
  }
  xhr.timeout = timeout;
  xhr.send(data ? data : '');
  return d.promise;
};

app.parser = function () {
  return new DOMParser();
};

app.l10n = function (id) {
  return chrome.i18n.getMessage(id);
};

app.windows = (function () {
  function toWindow (win) {
    return {
      obj: win,
      focus: function () {
        chrome.windows.update(win.id, {
          focused: true
        });
      }
    };
  }
  function toTab(tab) {
    return {
      get url () {
        return tab.url;
      },
      set url (val) {
        chrome.tabs.update(tab.id, {
          url: val
        });
      },
      activate: function () {
        chrome.tabs.update(tab.id, {
          active: true
        });
      },
      window: function () {
        var d = app.Promise.defer();
        chrome.windows.get(tab.windowId, {}, function (win) {
          d.resolve(toWindow(win));
        });
        return d.promise;
      },
      get active () {
        return tab.active;
      },
      close: function () {
        tab.close();
      }
    };
  }
  return {
    active: function () {
      var d = app.Promise.defer();
      chrome.windows.getCurrent({}, function (win) {
        d.resolve(toWindow(win));
      });
      return d.promise;
    },
    open: function (url, inBackground) {
      chrome.windows.create({
        url: url,
        focused: !inBackground
      });
    },
    tabs: {
      list: function (currentWindow) {
        var d = app.Promise.defer();
        chrome.tabs.query({
          currentWindow: currentWindow
        }, function (tabs) {
          d.resolve(tabs.map(toTab));
        });
        return d.promise;
      },
      active: function () {
        var d = app.Promise.defer();
        chrome.tabs.query({
          active: true,
          currentWindow: true
        }, function (tabs) {
          d.resolve(tabs && tabs.length ? toTab(tabs[0]) : null);
        });
        return d.promise;
      },
      open: function (url, inBackground) {
        chrome.tabs.query({
          active: true,
          currentWindow: true
        }, function (tabs) {
          (function () {
            if (config.tabs.open.relatedToCurrent || !config.tabs.open.useBlankTabs) {
              return app.Promise.resolve(null);
            }
            else {
              return app.windows.tabs.list(true).then(function (tabs) {
                return tabs.reduce(function (p, c) {
                  return p || (c.url === 'chrome://newtab/' ? c : null);
                }, null);
              });
            }
          })().then(function (t) {
            if (t) {
              t.url = url;
              if (!inBackground) {
                t.activate();
              }
            }
            else {
              chrome.tabs.create({
                url: url,
                index: config.tabs.open.relatedToCurrent && tabs && tabs.length ? tabs[0].index + 1 : null,
                active: !inBackground
              });
            }
          });
        });
      }
    }
  };
})();

app.notify = function (text, title) {
  title = title || app.l10n('gmail');
  if (config.notification.silent) {
    return;
  }
  var isArray = Array.isArray(text);
  if (isArray && text.length === 1) {
    isArray = false;
    text = text[0];
  }

  chrome.notifications.create(null, {
    type: isArray ? 'list' : 'basic',
    iconUrl: '../../../data/icons/notification/48.png',
    title: title,
    message: isArray ? '' : text,
    priority: 2,
    eventTime: Date.now() + 30000,
    items: isArray ? text.map(function (message) {
      var tmp = message.split('\n');
      return {
        title: tmp[0].replace('From: ', ''),
        message: tmp[1]
      };
    }): [],
    isClickable: true,
    requireInteraction: true
  }, function (id) {
    window.setTimeout(function (id) {
      chrome.notifications.clear(id, function () {});
    }, config.notification.time * 1000, id);
  });
};

app.play = (function () {
  var audio = document.createElement('audio');
  audio.setAttribute('preload', 'auto');
  audio.setAttribute('autobuffer', 'true');

  return function (index) {
    if (config.notification.silent) {
      return;
    }
    var type = index === null ? config.notification.sound.media.default.type : config.notification.sound.media['custom' + index].type;
    var path = '../../../data/sounds/' + type + '.wav';
    if (type === 4) {
      path = index === null ? config.notification.sound.media.default.file : config.notification.sound.media['custom' + index].file;
    }
    audio.src = path;
    audio.volume = config.notification.sound.volume / 100;
    audio.play();
  };
})();

app.clipboard = function () {};

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
};

app.startup = function (c) {
  c();
};

app.unload = (function () {
  var callbacks = [];
  window.addEventListener('unload', function () {
    callbacks.forEach(function (c) {
      c();
    });
  }, false);
  return function (c) {
    callbacks.push(c);
  };
})();

app.options = {
  send: function (id, data) {
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach(function (tab) {
        chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
      });
    });
  },
  receive: function (id, callback) {
    chrome.extension.onRequest.addListener(function (request, sender) {
      if (request.method === id && sender.tab) {
        callback(request.data);
      }
    });
  }
};

app.storage = (function () {
  var objs = {};
  chrome.storage.local.get(null, function (o) {
    objs = o;
    app.emit('load');
  });
  return {
    read: function (id) {
      return (objs[id] || !isNaN(objs[id])) ? objs[id] + '' : objs[id];
    },
    write: function (id, data) {
      objs[id] = data;
      var tmp = {};
      tmp[id] = data;
      chrome.storage.local.set(tmp, function () {});
    }
  };
})();

app.manifest = {
  url: chrome.extension.getURL('')
};

app.tray = {
  set: function () {},
  remove: function () {},
  callback: function () {}
};

app.contentScript = (function () {
  return {
    send: function (id, data, global) {
      if (global) {
        chrome.tabs.query({}, function (tabs) {
          tabs.forEach(function (tab) {
            chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
          });
        });
      }
      else if ('id' in this && 'windowId' in this) {
        chrome.tabs.sendMessage(this.id, {method: id, data: data}, function () {});
      }
      else {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
          tabs.forEach(function (tab) {
            chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
          });
        });
      }
    },
    receive: function (id, callback) {
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (message.method === id && sender.tab && sender.tab.url.indexOf('http') === 0) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();
/* updating badge when action is posted */
chrome.webRequest.onHeadersReceived.addListener(
  function (info) {
    if (info.url.indexOf('act=') !== -1) {
      app.emit('update');
    }
  },
  {urls: ['https://mail.google.com/mail/u*']},
  ['responseHeaders']
);
