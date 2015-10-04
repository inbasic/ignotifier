var {Cc, Ci, Cu}  = require('chrome'),
    {on, off, once, emit} = require('sdk/event/core'),
    buttons       = require("sdk/ui/button/action"),
    tabs          = require("sdk/tabs"),
    self          = require("sdk/self"),
    loader        = require('@loader/options'),
    array         = require('sdk/util/array'),
    data          = self.data,
    panel         = require("sdk/panel"),
    l10n          = require("sdk/l10n").get,
    timer         = require("sdk/timers"),
    pageWorker    = require("sdk/page-worker"),
    pageMod       = require("sdk/page-mod"),
    sp            = require("sdk/simple-prefs"),
    unload        = require("sdk/system/unload"),
    events        = require("sdk/system/events"),
    tabsUtils     = require("sdk/tabs/utils"),
    prefs         = sp.prefs,
    config        = require("../../config"),
    tbExtra       = require("./tbExtra"),
    windows       = {
      utils: require('sdk/window/utils'),
      get active () { // Chrome window
        return this.utils.getMostRecentBrowserWindow();
      },
      get SDKWindow () { // SDK window
        return require("sdk/windows").browserWindows.activeWindow
      },
    }

var exportsHelper = {};

Cu.import("resource://gre/modules/Promise.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// Event Emitter
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.emit = emit.bind(null, exports);
exports.removeListener = function removeListener (type, listener) {
  off(exports, type, listener);
};

/* popup */
var popup = panel.Panel({
  contentURL: data.url("./popup/index.html"),
  contentScriptFile: [
    data.url("./popup/index.js")
  ],
  contentScriptOptions: {
    base: loader.prefixURI + loader.name + "/"
  }
});
popup.on('show', () => popup.port.emit('show'));

/* button */
var button = buttons.ActionButton({
  id: self.name,
  label: l10n("toolbar_label"),
  icon: {
    "16": "./icons/blue/16.png",
    "32": "./icons/blue/32.png"
  },
  onClick: function() {
    if (button.onClick) {
      button.onClick();
    }
  }
});
tbExtra.setButton(button);

/* option */
var options = (function () {
  var workers = [], options_arr = [];
  pageMod.PageMod({
    include: data.url("options/index.html"),
    contentScriptFile: data.url("options/index.js"),
    contentScriptWhen: "start",
    contentScriptOptions: {
      base: loader.prefixURI + loader.name + "/"
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      // PageMod has no access to mozFullPath of input.
      worker.port.on("get-sound-fullpath", function () {
        var browserWindow = Cc["@mozilla.org/appshell/window-mediator;1"].
                        getService(Ci.nsIWindowMediator).
                        getMostRecentWindow("navigator:browser");
        var file = browserWindow.content.document.querySelector("input[type=file]").files[0].mozFullPath;
        config.notification.sound.custom.file = file;
      });
      options_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data) {
      workers.forEach(function (worker) {
        worker.port.emit(id, data);
      });
    },
    receive: (id, callback) => options_arr.push([id, callback])
  }
})();

function get (url, headers, data, timeout) {
  headers = headers || {};

  var d = new Promise.defer();
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
    .createInstance(Ci.nsIXMLHttpRequest);
  req.mozBackgroundRequest = true;  //No authentication
  req.timeout = timeout;
  req.open('GET', url, true);
  for (var id in headers) {
    req.setRequestHeader(id, headers[id]);
  }
  req.onreadystatechange = function () {
    if (req.readyState == 4) {
      d.resolve(req);
    }
  };
  req.channel
    .QueryInterface(Ci.nsIHttpChannelInternal)
    .forceAllowThirdPartyCookie = true;
  if (data) {
    var arr = [];
    for(e in data) {
      arr.push(e + "=" + data[e]);
    }
    data = arr.join("&");
  }
  req.send(data ? data : "");
  return d.promise;
}

/* exports */
exports.Promise = Promise;

exports.button = {
  onCommand: function (c) {
    button.onClick = c;
  },
  onContext: function (c) {
    tbExtra.onContext(function (e, menupopup, menuitem, menuseparator, menu) {
      var types = {
        "menupopup": menupopup,
        "menuitem": menuitem,
        "menuseparator": menuseparator,
        "menu": menu
      }
      // remove old items
      while (menupopup.firstChild) {
        menupopup.removeChild(menupopup.firstChild);
      }
      var items = c();
      function appendChilds (root, arr) {
        arr.forEach(function (e) {
          var element = types[e.type].cloneNode(false);
          ["label", "tooltip", "value", "link"].filter(function (i) {
            return e[i];
          }).forEach(function (i) {
            return element.setAttribute(i, e[i]);
          });
          if (e.command) {
            element.addEventListener("command", function (event) {
              event.preventDefault();
              event.stopPropagation();
              e.command(event);
            }, false);
          }
          root.appendChild (element);
          if (e.childs && e.childs.length) appendChilds(element, e.childs);
        });
      }
      appendChilds(menupopup, items);
    });
  },
  onClick: function (c) {
    tbExtra.onClick(c);
  },
  set label (val) {
    button.label = config.ui.tooltip ? val : l10n('toolbar_label');
  },
  set badge (val) {
    if (config.ui.badge) {
      tbExtra.setBadge(val);
    }
  },
  set color (val) {
    button.icon = {
      "16": "./icons/" + val + "/16.png",
      "32": "./icons/" + val + "/32.png"
    }
  }
}

exports.popup = {
  show: function () {
    popup.show({
      width: config.popup.width,
      height: config.popup.height,
      position: button
    });
  },
  hide: function () {
    popup.hide();
  },
  attach: function () {},
  detach: () => popup.hide(),
  send: function (id, data) {
    if (id === "resize") {
      popup.resize(data.width, data.height);
    }
    if (popup.isShowing) {
      popup.port.emit(id, data);
    }
  },
  receive: (id, callback) => popup.port.on(id, callback)
}

exports.timer = timer;

exports.get = get;

exports.parser = function () {
  return Cc["@mozilla.org/xmlextras/domparser;1"]
    .createInstance(Ci.nsIDOMParser);
}

exports.l10n = (id) => l10n(id);

exports.windows = (function () {
  function toWindow (win) {
    return {
      obj: win,
      focus: function () {
        (win.focus || win.activate)();
      }
    }
  }
  function toTab (tab) {
    return {
      get url () {
        return tab.url
      },
      set url (val) {
        if (tab.url == val) {
          tab.reload();
        }
        else {
          tab.url = val;
        }
      },
      activate: () => tab.activate(),
      window: () => Promise.resolve(toWindow(toWindow(tab.window))),
      get active () {
        return tab == tabs.activeTab;
      },
      close: function () {
        tab.close();
      }
    }
  }
  return {
    active: function () {
      return Promise.resolve(toWindow(windows.active));
    },
    open: function (url, inBackground) {
      var popup = windows.active.open(url);
      if (inBackground) {
        popup.blur();
        window.focus();
      }
    },
    tabs: {
      list: function (currentWindow) {
        var tbs = currentWindow ? windows.SDKWindow.tabs : tabs;
        var temp = [];
        for each (var tab in tbs) {
          temp.push(tab);
        }
        return Promise.resolve(temp.map(toTab));
      },
      active: function () {
        return Promise.resolve(toTab(tabs.activeTab));
      },
      open: function (url, inBackground) {
        var gBrowser = windows.active.gBrowser;
        // use old blank tabs?
        (function () {
          if (config.tabs.open.relatedToCurrent || !config.tabs.open.useBlankTabs) {
            return Promise.resolve(null);
          }
          return exports.windows.tabs.list(true).then(function (tabs) {
            return tabs.reduce(function (p, c) {
              return p || (c.url === "about:newtab" || c.url === "about:blank" ? c : null);
            }, null);
          });
        })().then(function (t) {
          if (t) {
            t.url = url;
            if (!inBackground) {
              t.activate();
            }
          }
          else {
            t = gBrowser.addTab(url, {
              relatedToCurrent: config.tabs.open.relatedToCurrent
            });
            if (!inBackground) {
              gBrowser.selectedTab = t;
            }
          }
        });
      }
    }
  }
})();

exports.notify = (function () { // https://github.com/fwenzel/copy-shorturl/blob/master/lib/simple-notify.js
  var alertServ = Cc["@mozilla.org/alerts-service;1"].
    getService(Ci.nsIAlertsService);

  return function (text, title , callback) {
    title = title || l10n("gmail");
    if (config.notification.silent) return;

    try {
      alertServ.showAlertNotification(
        data.url("icons/notification/32.png"),
        title,
        text,
        callback ? true : false,
        "",
        function (subject, topic, data) {
          if (topic == "alertclickcallback") {
            timer.setTimeout(callback, 100);
          }
        }, "");
    }
    catch(e) {
      let browser = windows.active.gBrowser,
          notificationBox = browser.getNotificationBox();

      notification = notificationBox.appendNotification(
        text,
        'jetpack-notification-box',
        data.url("icons/notification/16.png"),
        notificationBox.PRIORITY_INFO_MEDIUM,
        []
      );
      timer.setTimeout(function() {
        notification.close();
      }, config.notification.time * 1000);
    }
  }
})();

XPCOMUtils.defineLazyGetter(exportsHelper, "play", function () {
  Cu.import("resource://gre/modules/FileUtils.jsm");
  Cu.import("resource://gre/modules/Services.jsm");

  return {
    now: function () {
      if (config.notification.silent) return;

      var path = "../../data/sounds/" + config.notification.sound.original;
      if (config.notification.sound.type === 4 && config.notification.sound.custom.file) {
        var file = new FileUtils.File(config.notification.sound.custom.file);
        if (file.exists()) {
          path = Services.io.newFileURI(file).spec;
          let res = Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler);
          let name = 'igsound';
          res.setSubstitution(name, Services.io.newURI(path, null, null));
          path = 'resource://' + name;
        }
      }
      var worker = pageWorker.Page({
        contentScript:
          "var audio = new Audio('" + path + "');" +
          "audio.addEventListener('ended', function () {self.postMessage()});" +
          "audio.volume = " + (config.notification.sound.volume / 100) + ";" +
          "audio.play();",
        contentURL: data.url("firefox/sound.html"),
        onMessage: function() {
          worker.destroy();
        }
      });
    },
    reset: function () {}
  }
});
Object.defineProperty(exports, 'play', {
  get: function () {
    return exportsHelper.play;
  }
});

XPCOMUtils.defineLazyGetter(exportsHelper, "clipboard", function () {
  var clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper);
  return function (str) {
    clipboardHelper.copyString(str);
  }
});
Object.defineProperty(exports, 'clipboard', {
  get: function () {
    return exportsHelper.clipboard;
  }
});

exports.version = function () {
  return self.version;
}

exports.startup = function (c) {
  if (self.loadReason == "startup" || self.loadReason == "install") {
    c();
  }
}

exports.unload = function (c) {
  unload.when(c);
}

exports.options = options;

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + "" === "false" || !isNaN(prefs[id])) ? (prefs[id] + "") : null;
  },
  write: function (id, data) {
    data = data + "";
    if (data === "true" || data === "false") {
      prefs[id] = data === "true" ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + "";
    }
  }
}

exports.manifest = {
  url: loader.prefixURI + loader.name + "/"
}

exports.tray = require('./tray/wrapper').tray;

exports.contentScript = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: ['https://mail.google.com/*', 'https://gmail.com/*', 'http://mail.google.com/*', 'http://gmail.com/*'],
    contentScriptFile: [data.url('./content_script/firefox/firefox.js'), data.url('./content_script/inject_firefox.js')],
    contentScriptWhen: 'start',
    attachTo: ['top', 'existing'],
    contentScriptOptions: {
      base: data.url('.')
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data, global) {
      if (global === true) {
        workers.forEach(function (worker) {
          worker.port.emit(id, data);
        });
      }
      else if ('emit' in this) {
        this.emit(id, data);
      }
      else {
        workers.forEach(function (worker) {
          if (worker.tab !== tabs.activeTab) {
            return;
          }
          worker.port.emit(id, data);
        });
      }
    },
    receive: function (id, callback) {
      content_script_arr.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();

/* updating badge when action is posted */
function listener(event) {
  var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  var url = channel.URI.spec;
  if (url.indexOf('https://mail.google.com/mail/u') === -1 || url.indexOf('act=') === -1) {
    return;
  }
  channel = channel.QueryInterface(Ci.nsIHttpChannel);
  exports.emit('update');
}
events.on('http-on-modify-request', listener);
