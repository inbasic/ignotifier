var app = {};

i18n.init({
  resGetPath: "../../../_locales/en/messages.json"
});
/* exports */
app.Promise = Q.promise;
app.Promise.defer = Q.defer;

app.button = (function () {
  var callback,
      toolbarItem = safari.extension.toolbarItems[0];
  safari.application.addEventListener("command", function (e) {
    if (e.command === "toolbarbutton" && callback) {
      callback();
    }
  }, false);

  return {
    onCommand: function (c) {
      callback = c;
    },
    onContext: function () {},
    onClick: function () {},
    set label (val) {
      toolbarItem.toolTip = val;
    },
    set badge (val) {
      toolbarItem.badge = (val ? val : "") + "";
    },
    set color (val) {
      if (val === "red" || val === "new") {
        val = "new";
      }
      else if (val === "gray" || val === "load0" || val === "load2") {
        val = "clear";
      }
      else {
        val = "unknown";
      }
      toolbarItem.image = app.manifest.url + "data/icons/safari/" + val + ".png";
    },
  }
})();

app.popup = (function () {
  var callbacks = {},
      toolbarItem = safari.extension.toolbarItems[0];
      popup = safari.extension.createPopover("popover", safari.extension.baseURI + "data/popup/index.html", 100, 100);

  safari.application.addEventListener("popover", function (e) {
    popup.contentWindow.background.dispatchMessage("show");
    if (callbacks["show"]) {
      callbacks["show"]();
    }
  }, true);

  toolbarItem.popover = popup;
  return {
    show: function () {
      popup.width = config.popup.width;
      popup.height = config.popup.height;
      toolbarItem.showPopover();
    },
    hide: function () {
      popup.hide();
    },
    attach: function () {},
    detach: function () {
      popup.hide();
    },
    send: function (id, data) {
      if (id === "resize") {
        popup.width = data.width;
        popup.height = data.height;
      }
      popup.contentWindow.background.dispatchMessage(id, data);
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    },
    dispatchMessage: function (id, data) {
      if (callbacks[id]) {
        callbacks[id](data);
      }
    }
  }
})();

app.timer = window;

app.get = function (url, headers, data, timeout) {
  headers = headers || {};

  var xhr = new XMLHttpRequest();
  var d = new app.Promise.defer();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      d.resolve(xhr);
    }
  };
  xhr.open(data ? "POST" : "GET", url, true);
  for (var id in headers) {
    xhr.setRequestHeader(id, headers[id]);
  }
  if (data) {
    var arr = [];
    for(e in data) {
      arr.push(e + "=" + data[e]);
    }
    data = arr.join("&");
  }
  xhr.timeout = timeout;
  xhr.send(data ? data : "");
  return d.promise;
}

app.parser = function () {
  return new DOMParser();
}

app.l10n = function (id) {
  return i18n.t(id + ".message") || id;
}

app.windows = (function () {
  function toWindow (win) {
    return {
      obj: win,
      focus: function () {
        win.activate();
      }
    }
  }
  function toTab (tab) {
    return {
      get url () {
        return tab.url;
      },
      set url(val) {
        tab.url = val;
      },
      activate: function () {
        tab.activate();
      },
      window: function () {
        return new app.Promise(function (resolve) {
          resolve(toWindow(tab.browserWindow));
        });
      },
      get active () {
        return tab.browserWindow.activeTab == tab;
      },
      close: function () {
        tab.close();
      }
    }
  }

  return {
    active: function () {
      var win = safari.application.activeBrowserWindow;
      return new app.Promise(function (resolve) {
        resolve(toWindow(win));
      });
    },
    open: function (url, inBackground) {
      var popup = safari.application.openBrowserWindow();
      popup.activeTab.url = url;
      if (inBackground) {

      }
    },
    tabs: {
      list: function (currentWindow) {
        var wins = currentWindow ? [safari.application.activeBrowserWindow] : safari.application.browserWindows;
        var tabs = wins.map(function (win) {
          return win.tabs;
        });
        tabs = tabs.reduce(function (p, c) {
          return p.concat(c);
        }, []);
        tabs = tabs.map(toTab);
        return new app.Promise(function (a) {a(tabs)});
      },
      active: function () {
        return new app.Promise(function (resolve) {
          resolve(safari.application.activeBrowserWindow.activeTab);
        });
      },
      open: function (url, inBackground) {
        var index = safari.application.activeBrowserWindow.tabs.reduce(function (p,c,i){
          return c == safari.application.activeBrowserWindow.activeTab ? i : p
        }, 0);
        var tab = safari.application.activeBrowserWindow.openTab(
          inBackground ? "background" : "foreground",
          config.tabs.open.relatedToCurrent ? index + 1 : safari.application.activeBrowserWindow.tabs.length);
        tab.url = url;
      }
    }
  }
})();

app.notify = function(text, title, callback) {
  title = title || app.l10n("gmail");
  if (config.notification.silent) return;

  if(!window.Notification) {
    return;
  }

  var n = new Notification(title, {
      'body': text
  });

  n.onclick = function () {
    if (callback) {
      callback();
    }
  };
  window.setTimeout(function () {
    if (n) {
      n.close();
    }
  }, config.notification.time * 1000);
};

app.play = (function () {
  var audio, isActivated = false;
  // Audio only works on a window that has been visible at least once!
  function activate () {
    if (isActivated) {
      return new app.Promise(function (resolve) {
        resolve(true);
      });
    }
    var d = new app.Promise.defer();
    window.setTimeout(function () {
      app.popup.show();
      window.setTimeout(function () {
        app.popup.hide();
        d.resolve(true);
      }, 10);
    }, 0);
    isActivated = true;
    return d.promise;
  }
  function reset () {
    var win = safari.extension.toolbarItems[0].popover.contentWindow;
    var data = config.notification.sound.custom.file;

    if (config.notification.sound.type === 4 && data) {
      audio = new win.Audio(data);
    }
    else {
      audio = new win.Audio('../../../data/sounds/' + config.notification.sound.original);
    }
  }

  return {
    now: function () {
      if (config.notification.silent) return;
      if(!audio) reset();
      audio.volume = config.notification.sound.volume / 100;
      activate().then(function () {
        audio.play();
      });
    },
    reset: reset
  }
})();

app.clipboard = function () {}

app.version = function () {
  return safari.extension.displayVersion;
}

app.startup = function (c) {
  c();
}

app.unload = (function () {
  var callbacks = [];
  window.addEventListener("unload", function () {
    callbacks.forEach(function (c) {
      c()
    });
  }, false);
  return function (c) {
    callbacks.push(c);
  }
})();

app.options = (function () {
  var callbacks = {};
  safari.application.addEventListener("message", function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id](e.message.data);
    }
  }, false);
  return {
    send: function (id, data) {
      safari.application.browserWindows.forEach(function (browserWindow) {
        browserWindow.tabs.forEach(function (tab) {
          if (tab.page) tab.page.dispatchMessage(id, data);
        });
      });
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    }
  }
})(),

app.storage = {
  read: function (id) {
    return localStorage[id] || null;
  },
  write: function (id, data) {
    localStorage[id] = data + "";
  }
}

app.manifest = {
  url: safari.extension.baseURI
}

app.tray = {
  set: function () {},
  remove: function () {},
  callback: function () {}
}

