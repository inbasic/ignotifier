var {Cc, Ci, Cu}  = require('chrome'),
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
    
Cu.import("resource://gre/modules/Promise.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

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
      worker.on('pageshow', (w) => array.add(workers, w));
      worker.on('pagehide', (w) => array.remove(workers, w));
      worker.on('detach', (w) => array.remove(workers, w));
      
      options_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data) {
      workers.forEach(function (worker) {
        if (!worker || !worker.url) return;
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
    tbExtra.onContext(c);
  },
  set label (val) {
    button.label = val;
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
        var t = gBrowser.addTab(url, {
          relatedToCurrent: config.tabs.open.relatedToCurrent
        });
        if (!inBackground) {
          gBrowser.selectedTab = t;
        }
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

XPCOMUtils.defineLazyGetter(exports, "play", function () {
  Cu.import("resource://gre/modules/FileUtils.jsm");
  Cu.import("resource://gre/modules/Services.jsm");
  
  return {
    now: function () {
      if (config.notification.silent) return;

      var path = "../../data/sounds/" + config.notification.sound.original;
      if (config.notification.sound.type === 4 && config.notification.sound.custom) {
        var file = new FileUtils.File(config.notification.sound.custom);
        if (file.exists()) {
          path = Services.io.newFileURI(file);
        }
      }
      console.error(path)
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

XPCOMUtils.defineLazyGetter(exports, "clipboard", function () {
  var clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper);
  return function (str) {
    clipboardHelper.copyString(str);
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
    return (prefs[id] || prefs[id] + "" === "false") ? (prefs[id] + "") : null;
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