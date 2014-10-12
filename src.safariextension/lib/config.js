var isFirefox = typeof require !== 'undefined';
if (isFirefox) {
  var app = require('./wrapper/firefox/app');
  var os = require("sdk/system").platform;
  config = exports;
}
else {
  var config = {};
}

config.keyUp = false;

config.email = (function () {
  function feedFixer (val) {
    return val
      .split(",")
      .map(function (tag) {
        return tag
          .replace(/^\s\s*/, '')
          .replace(/\s\s*$/, '')
          .replace(/\s/g, "-").toLowerCase()
      })
      .filter(function (tag) {  // remove empty tags
        return tag;
      })
      .filter(function (t, i, a) {  // remove duplicate tags
        return a.indexOf(t) === i;
      })
      .join(", ");
  }
  return {
    url: "https://mail.google.com/mail/u/0",
    get feeds_0 () {
      return app.storage.read("feeds_0") || "";
    },
    set feeds_0 (val) {
      app.storage.write("feeds_0", feedFixer(val));
    },
    get feeds_1 () {
      return app.storage.read("feeds_1") || "";
    },
    set feeds_1 (val) {
      app.storage.write("feeds_1", feedFixer(val));
    },
    get feeds_2 () {
      return app.storage.read("feeds_2") || "";
    },
    set feeds_2 (val) {
      app.storage.write("feeds_2", feedFixer(val));
    },
    get feeds_3 () {
      return app.storage.read("feeds_3") || "";
    },
    set feeds_3 (val) {
      app.storage.write("feeds_3", feedFixer(val));
    },
    get feeds_4 () {
      return app.storage.read("feeds_4") || "";
    },
    set feeds_4 (val) {
      app.storage.write("feeds_4", feedFixer(val));
    },
    get feeds_5 () {
      return app.storage.read("feeds_5") || "";
    },
    set feeds_5 (val) {
      app.storage.write("feeds_5", feedFixer(val));
    },
    get feeds () {
      var tmp = ["0", "1", "2", "3", "4", "5"]
        .map(function (i) {
          return config.email["feeds_" + i];
        })
        .map(function (f, i) {
          return f.split(", ").map(function (tag) {
            if (!tag) return "";
            return tag.indexOf("http:") === -1 ? i + "/feed/atom/" + tag : tag;
          });
        });
      var merged = [];
      merged = merged.concat.apply(merged, tmp);
      merged = merged
        .filter(function (tag) {
          return tag;
        })
        .map(function (tag) {
          return tag.indexOf("http:") === -1 ? "https://mail.google.com/mail/u/" + tag : tag;
        })
        .sort();
      if (!merged.length) {
        merged = ["https://mail.google.com/mail/u/0/feed/atom/inbox"];
      }
      return merged;
    },
    timeout: 9000,
    get truncate () {
      return +app.storage.read("notificationTruncate") || 70;
    },
    set truncate (val) {
      val = +val;
      if (val % 2) { //odd number
        var oldVal = +app.storage.read("notificationTruncate");
        val = oldVal > val ? val - 1 : val + 1;
      }
      app.storage.write("notificationTruncate", Math.max(val, 20));
    },
    maxReport: 1, //Maximum number of simultaneous reports from a single account
    alphabetic: false,
    get doReadOnArchive () {
      return app.storage.read("doReadOnArchive") === "false" ? false : true;
    },
    set doReadOnArchive (val) {
      app.storage.write("doReadOnArchive", val);
    },
    check: {
      get first () {
        var tmp = app.storage.read("initialPeriod");
        if (tmp === null) return 5;
        tmp = +tmp;
        return isNaN(tmp) ? 5 : tmp;
      },
      set first (val) {
        val = +val;
        if (val < 0) val = 0;
        app.storage.write("initialPeriod", val);
      },
      get period () {
        return +app.storage.read("period") || 15;
      },
      set period (val) {
        val = parseInt(val);
        app.storage.write("period", val > 10 ? val : 10);
      },
      get resetPeriod () {
        var tmp = +app.storage.read("resetPeriod");
        return isNaN(tmp) ? 0 : tmp < 5 && tmp !== 0 ? 5 : tmp;
      },
      set resetPeriod (val) {
        val = +val;
        if (val < 0) val = 0;
        app.storage.write("resetPeriod", val);
        config.on.emit("email.check.resetPeriod");
      }
    }
  }
})();

config.notification = {
  get show () {
    return app.storage.read("notification") === "false" ? false : true;
  },
  set show (val) {
    app.storage.write("notification", val);
  },
  sound: {
    get play () {
      return app.storage.read("alert") === "false" ? false : true;
    },
    set play (val) {
      app.storage.write("alert", val);
    },
    get volume () {
      return +app.storage.read("soundVolume") || 80;
    },
    set volume (val) {
      val = +val;
      val = val < 100 ? val : 100;
      app.storage.write("soundVolume", val);
    },
    get type () { // 0-3: built-in, 4: user defined
      return +app.storage.read("soundNotification") || 0;
    },
    set type (val) {
      app.storage.write("soundNotification", val);
      app.play.reset();
    },
    get original () {
      return (this.type % 4) + ".wav";
    },
    custom: {
      get file () {
        return app.storage.read("sound_file");
      },
      set file (val) {
        app.storage.write("sound_file", val);
        app.play.reset();
      },
      get name () {
        return app.storage.read("sound_name") || "unknown";
      },
      set name (val) {
        app.storage.write("sound_name", val);
      },
      get mime () {
        return app.storage.read("sound_mime");
      },
      set mime (val) {
        app.storage.write("sound_mime", val);
      }
    }
  },
  get format () {
    return app.storage.read("notificationFormat") || "From: [author_email][break]Title: [title][break]Summary: [summary]";
  },
  set format (val) {
    app.storage.write("notificationFormat", val);
  },
  get time () {
    return +app.storage.read("notificationTime") || 8;
  },
  set time (val) {
    val = +val;
    app.storage.write("notificationTime", val > 3 ? val : 3);
  },
  silent: false
}

config.labels = {
  get tooltip () {
    return app.l10n("gmail") + (
      isFirefox ? "\n\n" + app.l10n("tooltip_1") + "\n" + app.l10n("tooltip_2") + "\n" + app.l10n("tooltip_3") : ""
    );
  }
}

config.ui = {
  badge: true,
  get pattern () { // 0: normal color scheme, 1: reverse color scheme
    return +app.storage.read("clrPattern");
  },
  set pattern (val) {
    app.storage.write("clrPattern", val);
    config.on.emit("ui.pattern");
  },
  fontFamily: "Arial",
  fontSize: "10px",
  height: "11px",
  lineHeight: "10px",
  backgroundColor: "#3366CC",
  color: "#fff",
  margin: {
    "1": "7px 3px 0 -13px", // badge length of "1"
    "2": "7px 3px 0 -19px",
    "3": "7px 3px 0 -23px",
    "4": "7px 3px 0 -27px"
  },
  width: {
    "1": "10px",  // badge width of "1"
    "2": "16px",
    "3": "20px",
    "4": "22px"
  },
  extra: ""
}

config.popup = {
  get width () {
    return this.mode === 0 ? this.normal.width : this.expanded.width;
  },
  get height () {
    return this.mode === 0 ? this.normal.height : this.expanded.height;
  },
  get mode () { // 0: normal, 1: expanded
    return +app.storage.read("size") || 0;
  },
  set mode (val) {
    app.storage.write("size", val);
  },
  normal: {
    width: 500,
    height: 240,
  },
  expanded: {
    get width () {
      return +app.storage.read("fullWidth") || 750;
    },
    set width (val) {
      val = +val;
      app.storage.write("fullWidth", val > 500 ? val : 500);
    },
    get height () {
      return +app.storage.read("fullHeight") || 600;
    },
    set height (val) {
      val = +val;
      app.storage.write("fullHeight", val > 500 ? val : 500);
    }
  },
  get display () { // false: plain-text, true: html
    return app.storage.read("render") === "false" ? false : true;
  },
  set display (val) {
    app.storage.write("render", val);
  }
}

config.tabs = {
  get search () { // true: current window only, false: all open windows
    return app.storage.read("searchMode") === "false" ? false : true;
  },
  set search (val) {
    app.storage.write("searchMode", val);
  },
  get NotifyGmailIsOpen () {
    return app.storage.read("onGmailNotification") === "true" ? true : false;
  },
  set NotifyGmailIsOpen (val) {
    app.storage.write("onGmailNotification", val);
  },
  open: {
    get background () {
      return app.storage.read("background") === "true" ? true : false;
    },
    set background (val) {
      app.storage.write("background", val);
    },
    get relatedToCurrent () {
      return app.storage.read("relatedToCurrent") === "true" ? true : false;
    },
    set relatedToCurrent (val) {
      app.storage.write("relatedToCurrent", val);
    },
    get _current () {
      return app.storage.read("currentTab") === "true" ? true : false;
    },
    set _current (val) {
      app.storage.write("currentTab", val);
    },
    get mode () { // 0: new tab, 1: new window, 2: current tab
      if (this._current) return 2;
      return 0;
    }
  }
}

config.welcome = {
  homepage: "http://add0n.com/gmail-notifier.html",
  get notification () {
    return app.storage.read("welcome") === "false" ? false : true;
  },
  set notification (val) {
    app.storage.write("welcome", val);
  },
  get version () {
    return app.storage.read("version");
  },
  set version (val) {
    app.storage.write("version", val);
  },
  time: 3000
}

config.tray = {
  get show () {
    return app.storage.read("show") === "false" ? false : true;
  },
  set show (val) {
    app.storage.write("show", val);
    config.on.emit("tray.show");
  },
  set doTrayCallback (val) {
    app.storage.write("doTrayCallback", val);
  },
  get doTrayCallback () {
    return app.storage.read("doTrayCallback") === "true" ? true : false;
  },
  id: {
    msg: 665,  // A random number
    unique: 24342 // A random number
  },
  time: {
    // "Balloon Tooltip" timeout
    get notification () {
      return +app.storage.read("notificationTime") || 3;
    },
    set notification (val) {
      val = +val;
      val = val > 3 ? val : 3;
      app.storage.write("notificationTime", val);
    }
  }
}

// Complex get and set
config.get = function (name) {
  return name.split(".").reduce(function(p, c) {
    return p[c]
  }, config);
}
config.set = function (name, value) {
  function set(name, value, scope) {
    name = name.split(".");
    if (name.length > 1) {
      set.call((scope || this)[name.shift()], name.join("."), value)
    }
    else {
      this[name[0]] = value;
    }
  }
  set(name, value, config);
}

config.on = (function () {
  var arr = {}
  function tmp (id, callback) {
    arr[id] = arr[id] || [];
    arr[id].push(callback);
  }
  tmp.emit = function (id) {
    (arr[id] || []).forEach(function (c) {
      c();
    })
  }
  return tmp;
})();