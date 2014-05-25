/** Require **/
var tabs          = require("sdk/tabs"),
    self          = require("sdk/self"),
    timer         = require("sdk/timers"),
    panel         = require("sdk/panel"),
    sp            = require("sdk/simple-prefs"),
    pageWorker    = require("sdk/page-worker"),
    _             = require("sdk/l10n").get,
    userstyles    = require("./userstyles"),
    plainText     = require('./plain-text'),
    prefs         = sp.prefs,
    data          = self.data,
    {Cc, Ci, Cu}  = require('chrome'),
    os            = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS,
    windows       = {
      get active () { // Chrome window
        return require('sdk/window/utils').getMostRecentBrowserWindow()
      },
      get activeWindow () { // SDK window
        return require("sdk/windows").browserWindows.activeWindow
      }
    },
    isAustralis   = "gCustomizeMode" in windows.active,
    toolbarbutton = isAustralis ? require("toolbarbutton/new") : require("toolbarbutton/old"),
    tray          = (function () {
      if (os == "WINNT") {
        return require('./tray/winnt/tray');
      }
      return {
        set: function () {},
        remove: function () {},
        callback: {
          install: function () {},
          remove: function () {}
        }
      };
    })();

/** Internal configurations **/
var config = {
  //Gmail
  email: {
    url: "https://mail.google.com/mail/u/0",
    FEEDS: "https://mail.google.com/mail/u/0/feed/atom," + 
      "https://mail.google.com/mail/u/1/feed/atom," + 
      "https://mail.google.com/mail/u/2/feed/atom," + 
      "https://mail.google.com/mail/u/3/feed/atom",
    get feeds() {
      //server implementation only supports atom feeds
      var temp = (prefs.feeds.replace(/rss20/g, "atom10") || config.email.FEEDS).split(",");
      //Check Feed formats
      temp.forEach(function (feed, index) {
        temp[index] = feed.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
      });
      //Validating URLS
      temp = temp.filter(function (url) {
        var valid = url.match(/^(ht|f)tps?:\/\/[a-z0-9-\.]+\.[a-z]{2,4}\/?([^\s<>\#%"\,\{\}\\|\\\^\[\]`]+)?$/);
        if (!valid) {
          console.error(_("msg14") + url);
        }
        return valid;
      });
      return temp;
    },
    maxCount: 20,
    maxReport: 1, //Maximum number of simultaneous reports from a single account
    timeout: 9000,
    get truncate () {
      return Math.ceil((Math.max(prefs.notificationTruncate, 20) || 70) / 2) * 2;
    }
  },
  //Timing
  get period () {return (prefs.period > 10 ? prefs.period : 10) * 1000},
  get resetPeriod () {
    if (!prefs.resetPeriod) {
      return 0; 
    }
    return (prefs.resetPeriod > 5 ? prefs.resetPeriod : 5) * 1000 * 60
  },
  get firstTime () {return prefs.initialPeriod * 1000},
  get desktopNotification () {return (prefs.notificationTime > 3 ? prefs.notificationTime : 3) * 1000},
  //Sound
  get soundVolume () {return (prefs.soundVolume < 100 ? prefs.soundVolume : 100) / 100},
  //Toolbar
  toolbar: {
    id: "igmail-notifier",
    move: {
      toolbarID: "nav-bar", 
      insertbefore: "home-button", 
      forceMove: true
    }
  },
  defaultTooltip: _("gmail") + "\n\n" + 
    _("tooltip1") + "\n" + _("tooltip2") + "\n" + _("tooltip3"),
  //Homepage:
  homepage: "http://add0n.com/gmail-notifier.html"
};

/** tray callback handling **/
tray.callback.install(function () {
  windows.active.focus();
  timer.setTimeout(onCommand, 100);
});

/** libraries **/
try {
  Cu.import("resource://gre/modules/Promise.jsm");
}
catch (e) {}
if (!Promise || !Promise.all) { //Support for FF < 25
  Promise = require('./q.js').Promise;
}

/** Global variables */
var tm, resetTm, gButton, emailsCache = [], server = new Server();

/** Loading style **/
(function () {
  userstyles.load(data.url("overlay.css"));
  if (os == "Linux") {
    userstyles.load(data.url("overlay-linux.css"));
  }
  else if (os == "Darwin") {
    userstyles.load(data.url("overlay-darwin.css"));
  }
})();

/** content downloader **/
function curl (url, timeout) {
  var d = new Promise.defer();
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
    .createInstance(Ci.nsIXMLHttpRequest);
  req.mozBackgroundRequest = true;  //No authentication
  req.timeout = timeout;
  req.open('GET', url, true);
  req.onreadystatechange = function () {
    if (req.readyState == 4) {
      d.resolve(req);
    }
  };
  req.channel.QueryInterface(Ci.nsIHttpChannelInternal)
    .forceAllowThirdPartyCookie = true;
  req.send(null);
  return d.promise;
}

/** URL parser **/
function url_parse (url) {
  var temp = /^(http.*):\/\/w{0,3}\.*([^\#\?]*)[^\#]*#*([^\/]*)/.exec(url.replace("gmail", "mail.google"));
  var temp2 =  /message_id\=([^&]*)|\#[^\/]*\/([^&]*)/.exec(url);
  return {
    protocol: temp && temp[1] ? temp[1] : "https",
    base: temp && temp[2] ? temp[2].replace(/\/$/, '') : config.email.url,
    label: temp && temp[3] ? temp[3] : "inbox",
    id: temp2 && (temp2[1] || temp2[2]) ? temp2[1] || temp2[2] : ""
  }
}

/** Open new Tab or reuse old tabs to open the url **/
function open (url, inBackground) {
  var parse2 = url_parse(url);
  if (windows.active) {
    for each(var tab in (prefs.searchMode ? windows.activeWindow.tabs : tabs)) {
      if (tab.url == url) {
        if (!prefs.onGmailNotification) notify(_("gmail"), _("msg8"));
        return;
      }
      var parse1 = url_parse(tab.url);
      if (parse1.base == parse2.base && !/to\=/.test(url)) {
        var reload = parse2.id && tab.url.indexOf(parse2.id) == -1;
        if (tab == tabs.activeTab && !reload) {
          if (!prefs.onGmailNotification) notify(_("gmail"), _("msg8"));
        }
        else if (tab == tabs.activeTab && reload) {
          tab.url = url;
        }
        if (tab != tabs.activeTab) {
          tab.activate();
          tab.window.activate();  // Focus not active window
          if (reload) {
            tab.url = url;
          }
        }
        return;
      }
    }
  }
  if (prefs.currentTab) {
    tabs.activeTab.url = url;
  }
  else {
    var gBrowser = windows.active.gBrowser;
    var t = gBrowser.addTab(url, {relatedToCurrent: prefs.relatedToCurrent});
    if (!inBackground) {
      gBrowser.selectedTab = t;
    }
  }
}

/** Multi account Panel **/
var contextPanel = panel.Panel({
  contentURL: data.url("context.html"),
  contentScriptFile: data.url("context.js")
});
contextPanel.port.on("resize", function({width, height, mode}) {
  contextPanel.resize(width, height);
  prefs.size = mode;
});
contextPanel.port.on("open", function (link) {
  contextPanel.hide();
  if (link) open(link);
});
contextPanel.port.on("action", function (link, cmd) {
  action(link, cmd, function (bol, err) {
    contextPanel.port.emit("action-response", cmd);
    tm.reset();
    if (!bol) {
      notify(_("gmail"), err);
    }
  });
});
contextPanel.port.on("body", function (link) {
  getBody(link, function (content) {
    contextPanel.port.emit("body-response", link, content);
  });
});
contextPanel.port.on("update", function () {
  tm.reset(true);
});
contextPanel.port.on("clipboard", (function () {
  var gClipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper);
  return function (str) {
    gClipboardHelper.copyString(str);
    notify(_("gmail"), _("msg13"));
  }
})());

/** onCommand **/
var onCommand = function (e) {
  if (!gButton.badge) {
    open(config.email.url);
  }
  else if (gButton.badge == 1 && prefs.oldFashion == "1") {
    //open(unreadObjs[0].link);
  }
  else {
    contextPanel.port.emit("resize", prefs.size);
    contextPanel.show(gButton.object);
  }
}

/** Toolbar button **/
gButton = toolbarbutton.ToolbarButton({
  id: config.toolbar.id,
  label: _("gmail"),
  tooltiptext: config.defaultTooltip,
  onClick: function (e) { //Linux problem for onClick
    if (e.button == 1 || (e.button == 0 && e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (prefs.middleClick == 1) {
        open(config.email.url);
      }
      else {
        if (!tm) tm = new manager ("firstTime", "period", server);
        tm.reset(true);
      }
    }
  },
  onContext: (function () {
    return function (e, menupopup, _menuitem, _menuseparator) {
      //Install command event listener
      if (!menupopup.installed) {
        menupopup.addEventListener("command", function (e) {
          var link = e.originalTarget.value;
          if (link) open(link.replace(/\?.*/ , ""));
        });
        menupopup.installed = true;
      }
      //remove old items
      while (menupopup.firstChild) {
        menupopup.removeChild(menupopup.firstChild);
      }
      var tmp = (function () {  //[title, link] (no duplicated account)
        var t1 = emailsCache.map(o => [o.xml.title, o.xml.link]);
        var t2 = [];
        return t1.filter(function (o) {
          if (t2.indexOf(o[0]) !== -1) return false;
          t2.push(o[0]);
          return true;
        })
      })();
      function addChild (label, value) {
        var item = _menuitem.cloneNode(true);
        item.setAttribute("label", label);
        item.setAttribute("value", value);
        menupopup.appendChild(item);
        return item;
      }
      if (tmp.length) {
        tmp.forEach(function (obj) {
          addChild(obj[0], obj[1]);
        });
      }
      else {
        addChild(_("context"), "");
      }
      //Permanent List
      menupopup.appendChild(_menuseparator.cloneNode(false));
      addChild(_("label1"), "").addEventListener("command", function (e) {
        if (!tm) tm = new manager ("firstTime", "period", server);
        tm.reset(true);
      });
      addChild(_("label2"), "").addEventListener("command", function (e) {
        windows.active.BrowserOpenAddonsMgr(
          "addons://detail/" + encodeURIComponent("jid0-GjwrPchS3Ugt7xydvqVK4DQk8Ls@jetpack")
        );
      });
    }
  })(),
  onCommand: onCommand
});

/** icon designer**/
var icon = (function () {
  var i = 0, t = [];
  
  function clearTimeout () {
    t.forEach(function (_t) {
      timer.clearTimeout(t);
      t.splice(t.indexOf(t), 1);
    });
  }
  
  return function (number, clr) {
    // Big count number?
    gButton.badge = number;
    // Change color pattern?
    if (prefs.clrPattern == 1) {
      switch (clr) {
        case "blue":
          clr = "gray";
          break;
        case "gray":
          clr = "blue";
          break;
      }
    }
    
    if (clr == "load") {
      clearTimeout();
      t.push(timer.setTimeout(function () {
        gButton.type = "load" + i;
        i += 1;
        i = i % 4;
        icon(number, "load");
      }, 200));
    }
    else if (clr == "new") {
      clearTimeout();
      t.push(timer.setTimeout(function () {
        gButton.type = i % 2 ? "red" : "new"
        if (i < 7) {
          i += 1;
          icon(number, "new");
        }
        else {
          i = 0;
        }
      }, 300));
    }
    else {
      i = 0;
      clearTimeout();
      gButton.type = clr;
    }
  }
})();
icon(null, "blue");

/** Initialize **/
exports.main = function(options, callbacks) {
  //Timers
  if (config.firstTime) {
    tm = new manager ("firstTime", "period", server);
  }
  if (config.resetPeriod) {
    resetTm = new manager ("resetPeriod", "resetPeriod", reset);
  }
  //Install
  if (options.loadReason == "install" || prefs.forceVisible) {
    //If adjacent button is restartless wait for its creation
    timer.setTimeout(function (){
      gButton.moveTo(config.toolbar.move);
    }, 800);
  }
  //Welcome page
  if (options.loadReason == "upgrade" || options.loadReason == "install") {
    prefs.newVersion = options.loadReason;
  }
  if (options.loadReason == "startup" || options.loadReason == "install") {
    welcome();
  }
};

exports.onUnload = function (reason) {
  tray.remove();
  tray.callback.remove();
}

/** Prefs Listener**/
sp.on("clrPattern", function () {
  tm.reset();
});
sp.on("resetPeriod", (function () {
  var _timer;
  return function () {
    if (_timer) timer.clearTimeout(_timer);
    _timer = timer.setTimeout(function () {
      if (config.resetPeriod) {
        if (resetTm) {
          resetTm.reset();
        }
        else {
          resetTm = new manager ("resetPeriod", "resetPeriod", reset);
        }
      }
      else if (resetTm) {
        resetTm.stop();
      }
    }, 10000);  // No notification during the setting change
  }
})());

/** Interval manager **/
var manager = function (once, period, func) {
  var _timer, first = true;
  function run (once, period, param) {
    _timer = timer.setTimeout(function () {
      func(first ? param : null);
      first = false;
      run(once, period);
    }, first ? config[once] : config[period]);
  }
  run(once, period);
  
  return {
    reset: function (forced) {
      timer.clearTimeout(_timer);
      first = true;
      run(0, period, forced);
    },
    stop: function () {
      timer.clearTimeout(_timer);
    }
  }
};

/** Reset timer to remind user for unread emails **/
var reset = function () {
  tm.reset(true);
}

/** User's actions **/
tabs.on('ready', function (tab) {
  if (/mail\.google\.com/.test(tab.url)) {
    tm.reset();
  }
});
/** Welcome page **/
var welcome = function () {
  if (!prefs.newVersion) return;
  if (prefs.welcome) {
    timer.setTimeout(function () {
      open(config.homepage + "?v=" + self.version + "&type=" + prefs.newVersion);
      prefs.newVersion = "";
    }, 3000);
  }
  else {
    prefs.newVersion = "";
  }
}

function Server () {
  function Parse(req, feed) {
    var xml;
    if (req.responseXML) {
      xml = req.responseXML;
    }
    else {
      if (!req.responseText) return;
      
      var parser = Cc["@mozilla.org/xmlextras/domparser;1"]
        .createInstance(Ci.nsIDOMParser);
      xml = parser.parseFromString(req.responseText, "text/xml");
    }
    //Sometimes id is wrong in the feed structure!
    function fixID (link) {
      var id = /u\/\d/.exec(feed);  
      if (id.length) {
        return link.replace(/u\/\d/, id[0]);
      };
      return link;
    }
    return {
      get fullcount () {
        var temp = 0;
        var tags = xml.getElementsByTagName("fullcount");
        var entries = xml.getElementsByTagName("entry");
        try {
          var temp = (tags && tags.length) ? parseInt(tags[0].textContent) : 0;
          temp = Math.max(temp, (entries && entries.length) ? entries.length : 0);
        } catch(e) {}
        return temp;
      },
      get title () {
        var temp = "";
        try {
          temp = xml.getElementsByTagName("title")[0].childNodes[0].nodeValue;
          temp = temp.match(/[^ ]+@.+\.[^ ]+/)[0];
        } catch(e) {}
        return temp;
      },
      get label () {
        var label = "";
        try {
          var tagline = xml.getElementsByTagName("tagline")[0].childNodes[0].nodeValue;
          if (tagline) {
            var match = tagline.match(/\'(.*)\' label/);
            if (match.length == 2) {
              label = match[1];
            }
          }
        } catch(e) {}
        return label;
      },
      get link () {
        var temp = config.email.url,
            label;
        try {
          //Inbox href
          temp = xml.getElementsByTagName("link")[0].getAttribute("href").replace("http://", "https://");
          temp = fixID (temp);
          label = this.label;
          if (label) {
            temp += "/?shva=1#label/" + label;
          }
        } catch(e) {}

        return temp;
      },
      get authorized () {
        var temp = "";
        try {
          temp = xml.getElementsByTagName("TITLE")[0].childNodes[0].nodeValue;
        } catch(e){}
        return temp;
      },
      get entries () {
        var tmp = Array.prototype.slice.call( xml.getElementsByTagName("entry") );
        function toObj (entry) {
          return {
            get title () {
              return entry.getElementsByTagName("title")[0].textContent;
            },
            get summary () {
              return entry.getElementsByTagName("summary")[0].textContent;
            },
            get modified () {
              return entry.getElementsByTagName("modified")[0].textContent;
            },
            get issued () {
              return entry.getElementsByTagName("issued")[0].textContent;
            },
            get author_name () {
              return entry.getElementsByTagName("author")[0]
                .getElementsByTagName("name")[0].textContent;
            },
            get author_email () {
              return entry.getElementsByTagName("author")[0]
                .getElementsByTagName("email")[0].textContent;
            },
            get id () {
              return entry.getElementsByTagName("id")[0].textContent;
            },
            get link () {
              var temp = entry.getElementsByTagName("link")[0].getAttribute("href").replace("http://", "https://");
              temp = fixID (temp);
              return temp;
            }
          }
        }
        var rtn = [];
        tmp.forEach(function (entry) {
          rtn.push(new toObj(entry));
        });
        return rtn;
      }
    }
  }

  function Email (feed, timeout) {
    var ids = [], pCount = 0;
    var d;
    return {
      execute: function () {
        d = new Promise.defer();
        new curl(feed, timeout).then(
          function (req) {
            if (req.status != 200) {
              return d.resolve({
                network: req.status !== 0,
                notAuthorized: req.status === 401,
                xml: null,
                newIDs: []
              });
            }
            var xml = new Parse(req, feed);
            //Cleaning old entries
            var cIDs = xml.entries.map(e => e.id);
            //Finding new ids
            var newIDs = cIDs.filter(id => ids.indexOf(id) === -1);
            ids.push.apply(ids, newIDs);
            if (pCount >= 20 && pCount >= xml.fullcount) {
              newIDs = [];
            }
            pCount = xml.fullcount;
            d.resolve({
              network: true,
              notAuthorized: false,
              xml: xml,
              newIDs: newIDs
            });
          }
        );
        return d.promise;
      },
      reject: function () {
        if (d) d.reject();
      }
    }

  }
  var emails = config.email.feeds.map((feed) => new Email(feed, config.email.timeout));
  return (function () {
    var color = "blue", count = -1;
    return function (forced) {
      if (forced) {
        icon(null, "load"); 
        color = "load";
      }
      // Cancel previous execution?
      emails.forEach(e => e.reject());
      // Execute fresh servers
      Promise.all(emails.map(e => e.execute())).then(function (objs) {
        var isAuthorized = objs.reduce((p, c) => p || (!c.notAuthorized && c.network), false);
        var anyNewEmails = objs.reduce((p, c) => p || (c.newIDs.length !== 0), false);
        if (!isAuthorized) {
          if (color !== "blue") {
            icon(null,  "blue");
            color = "blue";
            count = -1;
            contextPanel.hide();
          }
          if (forced) {
            open(config.email.url);
            notify(_("gmail"), _("msg1"), false);
          }
          tray.remove();
          gButton.tooltiptext = config.defaultTooltip;
          contextPanel.hide();
          return;
        }
        //Removing not logged-in accounts
        objs = objs.filter(o => o.network && !o.notAuthorized);
        //Sorting accounts
        objs.sort(function(a,b) {
          var var1 = prefs.alphabetic ? a.xml.title : a.xml.link,
              var2 = prefs.alphabetic ? b.xml.title : b.xml.link;
          if (var1 > var2) return 1;
          if (var1 < var2) return -1;
          return 0;
        });
        // New total count number
        var newCount = objs.reduce((p,c) => p + c.xml.fullcount, 0);
        // 
        if (!anyNewEmails && !forced && count === newCount) {
          contextPanel.port.emit('update-date', objs); //Updating the date of the panel
          return; //Everything is clear
        }
        count = newCount;
        //
        emailsCache = objs;
        // Preparing the report
        var tmp = [];
        objs.forEach (function (o) {
          o.xml.entries
            .filter(e => anyNewEmails ? o.newIDs.indexOf(e.id) !== -1 : o.xml.fullcount !== 0)
            .splice(0, config.email.maxReport).forEach(function (e) {
            tmp.push(e);
          });
        });
        function shorten (str) {
          if (str.length < config.email.truncate) return str;
          return str.substr(0, config.email.truncate / 2) + "..." + str.substr(str.length - config.email.truncate / 2);
        }
        var report = tmp.map(e => prefs.notificationFormat
          .replace("[author_name]", e.author_name)
          .replace("[author_email]", "<" + e.author_email + ">")
          .replace("[summary]", shorten(e.summary))
          .replace("[title]", shorten(e.title))
          .replace(/\[break\]/g, "\n")).join("\n\n");
        // Preparing the tooltip
        var tooltip = 
          _("gmail") + "\n\n" + 
          objs.reduce((p,c) => 
            p += c.xml.title + 
            (c.xml.label ? " [" + c.xml.label + "]" : "") +
            " (" + c.xml.fullcount + ")" + "\n", ""
          ).replace(/\n$/, "");  
        if (!forced && !anyNewEmails) {
          if (newCount) {
            icon(newCount,  "red");
            color = "red";
            if (prefs.tray) tray.set(newCount, tooltip);
            gButton.tooltiptext = tooltip;
            contextPanel.port.emit('update', objs);
          }
          else {
            icon(null,  "gray");
            color = "gray";
            tray.remove();
            gButton.tooltiptext = tooltip;
            contextPanel.hide();
          }
        }
        else if (forced && !newCount) {
          icon(null,  "gray");
          color = "gray";
          tray.remove();
          gButton.tooltiptext = tooltip;
          contextPanel.hide();
        }
        else {
          icon(newCount, "new");
          color = "new";
          if (prefs.notification) {
            notify(_("gmail"), report, true);
          }
          if (prefs.tray) tray.set(newCount, tooltip);
          if (prefs.alert) play();
          gButton.tooltiptext = tooltip;
          contextPanel.port.emit('update-reset', objs);
        }
      });
    }
  })()
}

/** Prefs **/
sp.on("reset", function() {
  if (!windows.active.confirm(_("msg7"))) return
  prefs.alphabetic          = false;
  prefs.alert               = true;
  prefs.notification        = true;
  prefs.period              = 15;
  prefs.soundNotification   = 1;
  prefs.resetPeriod         = 0;
  prefs.initialPeriod       = 1;
  prefs.feeds               = config.email.FEEDS;
  prefs.clrPattern          = 0;
  prefs.oldFashion          = 0;
  prefs.forceVisible        = true; 
  prefs.middleClick         = 0;
  prefs.onGmailNotification = false;
  prefs.notificationDetails = 1;
  prefs.welcome             = true;
  prefs.searchMode          = true;
  prefs.relatedToCurrent    = true;
  prefs.size                = 0;
  prefs.currentTab          = false;
  prefs.doReadOnArchive     = true;
  prefs.soundVolume         = 80;
  prefs.tray                = true;
  prefs.notificationFormat  = "From: [author_email][break]Title: [title][break]Summary: [summary]";
  prefs.doTrayCallback      = false;
});
sp.on("tray", function() {
  if (!prefs.tray) {
    tray.remove();
  }
  else {
    tm.reset(true);
  }
});

/**
 * Send archive, mark as read, mark as unread, and trash commands to Gmail server
 * @param {String} link, xml.link address
 * @param {String} cmd: rd, ur, rc_%5Ei, tr, sp
 * @param {Function} callback, callback function. True for successful action
 * @return {Object} pointer, callback apply object.
 */
var action = (function () {
  function getAt_2 (url, callback, pointer) {
    new curl(url + "h/" + Math.ceil(1000000 * Math.random())).then (function (req) {
      if (!req) return;
      if(req.status == 200) {
        var tmp = /at\=([^\"\&]*)/.exec(req.responseText);
        if (callback) callback.apply(pointer, [tmp && tmp.length > 1 ? tmp[1] : null]);
      }
      else {
        if (callback) callback.apply(pointer, [null]);
      }
    });
  }
  function getAt (url, callback, pointer) {
    new curl(url).then(function (req) {
      if(req.status == 200) {
        var tmp = /GM_ACTION_TOKEN\=\"([^\"]*)\"/.exec(req.responseText);
        if (tmp && tmp.length) {
          if (callback) callback.call(pointer, tmp[1]);
        }
        else {
          getAt_2(url, callback, pointer);
        }
      }
      else {
        if (callback) callback.apply(pointer, [null]);
      }
    });
  }
  
  function sendCmd (url, at, threads, cmd, callback, pointer) {
    if (cmd == "rc_%5Ei" && prefs.doReadOnArchive) {
      sendCmd(url, at, threads, "rd");
    }
    var u = url + "?at=" + at + "&act=" + cmd.replace("rd-all", "rd");
    u += "&t=" + threads.join("&t=");
    new curl(u).then(function (req) {
      if (!req) return;
      if(req.status == 200) {
        if (callback) callback.apply(pointer, [true]);
      }
      else {
        if (callback) callback.apply(pointer, [false]);
      }
    });
  }
  
  return function (links, cmd, callback, pointer) {
    if (typeof(links) == "string") {
      links = [links];
    }

    var url = /[^\?]*/.exec(links[0])[0] + "/";
    getAt(url, function (at) {
      if (at) {
        var threads = [];
        links.forEach(function (link) {
          var thread = /message\_id\=([^\&]*)/.exec(link);
          if (thread && thread.length) {
            threads.push(thread[1]);
          }
        });
        if (threads.length) {
          sendCmd(url, at, threads, cmd, function () {
            if (callback) callback.apply(pointer, [true]);
          });
        }
        else {
          if (callback) callback.apply(pointer, [false, "Error at resolving thread"]);
        }
      }
      else {
        if (callback) callback.apply(pointer, [false, "Error at fetching 'at'"]); 
      }
    });
  }
})();

/** Get mail body **/
var getBody = (function () {
  function getIK (url, callback, pointer) {
    new curl(url).then(function (req) {
      var tmp = /var GLOBALS\=\[(?:([^\,]*)\,){10}/.exec(req.responseText || "");
      if (callback) {
        callback.apply(pointer, [tmp && tmp.length > 1 ? tmp[1].replace(/[\"\']/g, "") : null]);
      }
    });
  }
  
  return function (link, callback, pointer) {
    link = link.replace("http://", "https://");
    var url = /[^\?]*/.exec(link)[0] + "/";
    var thread = /message\_id\=([^\&]*)/.exec(link);
    if (thread.length > 1) {
      getIK(url, function (ik) {
        if (!ik) {
          if (callback) callback.apply(pointer, ["Error at resolving user's static ID. Please switch back to summary mode."]);
          return;
        }
        new curl(url + "?ui=2&ik=" + ik + "&view=pt&search=all&th=" + thread[1]).then(function (req) {
          var parser = Cc["@mozilla.org/xmlextras/domparser;1"]
            .createInstance(Ci.nsIDOMParser);
          var html = parser.parseFromString(req.responseText, "text/html");
          var message = html.documentElement.getElementsByClassName("message");
          var body = "...";
          try {
            body = plainText.getPlainText(message[message.length - 1].children[0].children[2], url);
          } catch (e) {}
          if (callback) callback.apply(pointer, [body]);
        });
      });
    }
    else {
      if (callback) callback.apply(pointer, ["Error at resolving thread. Please switch back to summary mode."]);
    }
  }
})();

/** Notifier **/
var notify = (function () { // https://github.com/fwenzel/copy-shorturl/blob/master/lib/simple-notify.js
  return function (title, text, clickable, link) {
    try {
      let alertServ = Cc["@mozilla.org/alerts-service;1"].
                      getService(Ci.nsIAlertsService);
      alertServ.showAlertNotification(data.url("notification.png"), title, text, clickable, link, 
        function (subject, topic, data) {
          if (topic == "alertclickcallback") {
            timer.setTimeout(function () {
              // If main window is not focused, restore it first!
              windows.active.focus();
              timer.setTimeout(onCommand, 100);
            }, 100);
          }
        }, "");
    }
    catch(e) {
      let browser = window.active.gBrowser,
          notificationBox = browser.getNotificationBox();

      notification = notificationBox.appendNotification(text, 'jetpack-notification-box',
          data.url("notification.png"), notificationBox.PRIORITY_INFO_MEDIUM, []
      );
      timer.setTimeout(function() {
          notification.close();
      }, config.desktopNotification);
    }
  }
})();

/** Player **/
var play = function () {
  var path = "alert.wav";
  
  if (prefs.soundNotification == 2 && prefs.sound) {
    let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(prefs.sound);
    if (file.exists()) {
      let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      path = ios.newFileURI(file).spec;
    }
  }

  var worker = pageWorker.Page({
    contentScript: "var audio = new Audio('" + path + "'); audio.addEventListener('ended', function () {self.postMessage()}); audio.volume = " + config.soundVolume + "; audio.play();",
    contentURL: data.url("sound.html"),
    onMessage: function(arr) {
      worker.destroy();
    }
  });
}