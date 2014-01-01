/** Require **/
var tabs          = require("sdk/tabs"),
    self          = require("sdk/self"),
    timer         = require("sdk/timers"),
    panel         = require("sdk/panel"),
    sp            = require("sdk/simple-prefs"),
    pageWorker    = require("sdk/page-worker"),
    _             = require("sdk/l10n").get,
    toolbarbutton = require("./toolbarbutton"),
    userstyles    = require("./userstyles"),
    plainText     = require('./plain-text'),
    prefs         = sp.prefs,
    data          = self.data,
    {Cc, Ci, Cu}  = require('chrome'),
    windows       = {
      get active () { // Chrome window
        return require('sdk/window/utils').getMostRecentBrowserWindow()
      },
      get activeWindow () { // SDK window
        return require("sdk/windows").browserWindows.activeWindow
      }
    };
    
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
      var temp = (prefs.feeds.replace(/rss20/g, "atom10") || FEEDS).split(",");
      //Check Feed formats
      temp.forEach(function (feed, index) {
        temp[index] = feed.replace(/^\s\s*/, '').replace(/\s\s*$/, '')
      });
      return temp;
    },
    maxCount: 20
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
      get insertbefore () {
        var id = prefs.nextSibling;
        return id ? id : "home-button"
      }, 
      forceMove: false
    }
  },
  defaultTooltip: _("gmail") + "\n\n" + 
    _("tooltip1") + "\n" + _("tooltip2") + "\n" + _("tooltip3"),
  //Homepage:
  homepage: "http://add0n.com/gmail-notifier.html"
};

var tm, resetTm, gButton, unreadObjs = [], loggedins  = [];

/** Loading style **/
(function () {
  userstyles.load(data.url("overlay.css"));
  var runtime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
  if ("gCustomizeMode" in windows.active && runtime.OS == "WINNT") { //Australis
    userstyles.load(data.url("overlay-australis.css"));
  }
  else if (runtime.OS == "Linux") {
    userstyles.load(data.url("overlay-linux.css"));
  }
  else if (runtime.OS == "Darwin") {
    userstyles.load(data.url("overlay-darwin.css"));
  }
})();

/** curl **/
function curl (url, callback, pointer) {
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
    .createInstance(Ci.nsIXMLHttpRequest);
  req.mozBackgroundRequest = true;  //No authentication
  req.open('GET', url, true);
  req.onreadystatechange = function () {
    if (req.readyState == 4) {
      if (callback) callback.apply(pointer, [req]);
    }
  };
  req.channel.QueryInterface(Ci.nsIHttpChannelInternal)
    .forceAllowThirdPartyCookie = true;
  req.send(null);
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

/** Multi email Panel **/
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
contextPanel.port.on("decrease_mails", function (iIndex, jIndex) {
  //decrease the number of mails
  unreadObjs[iIndex].entries.splice(jIndex, 1);
  unreadObjs[iIndex].count -= 1;

  var total = 0;
  unreadObjs.forEach(function (e, i) {
    total += e.count;
  });

  if (total > 0) {
    icon(total, "red");
  }
  else {
    icon(total, "gray");
  }
  /*
  //Refresh Gmail tab
  for each(var tab in tabs) {
    if (tab.url.indexOf(unreadObjs[iIndex].link.replace("http", "").replace("https", ""))) {
      tab.attach({
        contentScript: 'var evt = document.createEvent("KeyboardEvent");evt.initKeyEvent("keypress",true,true,null,0,0,0,0,0,117);document.dispatchEvent(evt);'
      });
    }
  }
  */
});
contextPanel.port.on("update", function () {
  tm.reset(true);
});
contextPanel.port.on("clipboard", (function () {
  var gClipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper);
  return function (str) {
    gClipboardHelper.copyString(str);
    notify(_("gmail"), _("msg13"), true);
  }
})());

/** onCommand **/
var onCommand = function (e) {
  if (!unreadObjs.length) {
    open(config.email.url);
  }
  else if (unreadObjs.length == 1 && prefs.oldFashion == "1") {
    open(unreadObjs[0].link);
  }
  else {
    contextPanel.port.emit("resize", prefs.size);
    try {
      contextPanel.show(gButton.object);
    }
    catch (e) {
      contextPanel.show(null, gButton.object);
    }
    contextPanel.port.emit('command', unreadObjs);
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
        if (!tm) tm = new manager ("firstTime", "period", checkAllMails);
        tm.reset(true);
      }
    }
  },
  onContext: (function () {
    var installed = false;
    return function (e, menupopup, _menuitem, _menuseparator) {
      //Install command event listener
      if (!installed) {
        menupopup.addEventListener("command", function (e) {
          var link = e.originalTarget.value;
          if (link) open(link.replace(/\?.*/ , ""));
        });
        installed = true;
      }
      //In case where user also listening on different labels than inbox, there would be duplicated elements
      var temp = (function (arr) {
        arr.forEach(function (item, index) {
          for (var i = index + 1; i < arr.length; i++) {
            if (arr[i] && item.label == arr[i].label) {delete arr[index]}
          }
        });
        return arr.filter(function (item){return item});
      })(loggedins);
      //remove old items
      while (menupopup.firstChild) {
        menupopup.removeChild(menupopup.firstChild);
      }
      function addChild (label, value) {
        var item = _menuitem.cloneNode(true);
        item.setAttribute("label", label);
        item.setAttribute("value", value);
        menupopup.appendChild(item);
        return item;
      }
      if (temp.length) {
        temp.forEach(function (obj) {
          addChild(obj.label, obj.link);
        });
      }
      else {
        addChild(_("context"), "");
      }
      //Permanent List
      menupopup.appendChild(_menuseparator.cloneNode(false));
      addChild(_("label1"), "").addEventListener("command", function (e) {
        if (!tm) tm = new manager ("firstTime", "period", checkAllMails);
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
    tm = new manager ("firstTime", "period", checkAllMails);
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

/** Store toolbar button position **/
var aWindow = windows.active;
var aftercustomizationListener = function () {
  let button = aWindow.document.getElementById(config.toolbar.id);
  if (!button) return;
  prefs.nextSibling = button.nextSibling.id;
}
aWindow.addEventListener("aftercustomization", aftercustomizationListener, false);
exports.onUnload = function (reason) {
  aWindow.removeEventListener("aftercustomization", aftercustomizationListener, false); 
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

/** Server **/
var server = {
  parse: function (req, feed) {
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
          temp = xml.getElementsByTagName("link")[0].getAttribute("href");
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
              var temp = entry.getElementsByTagName("link")[0].getAttribute("href");
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
  },
  /* check gmail
   * feed: feed url
   * callback: callback function [xml, count, color, [title, text]]
   * pointer: callback this pointer
   */
  mCheck: function (feed, callback, pointer) {
    var state = false,
        msgs = [],
        oldCount = 0; //For more than 20 unreads
    /*
     * forced: is this a forced check?
     * isRecent: did user recently receive a notification?
     */
    return function (forced, isRecent) {
      //Check state
      if (state && !forced) {
        return;
      }
      //Initialazing
      state = true;
      new curl(feed, function (req) {
        if (!req) return;
        var xml = new server.parse(req, feed);
        
        var count = 0;
        var normal = false; //not logged-in but normal response from gmail
        var newUnread = false, newText;
        var exist = req.status == 200;  //Gmail account is loged-in
        if (exist) {
          count = xml.fullcount;
          if (oldCount > config.email.maxCount || count > config.email.maxCount) {
            newUnread = (count > oldCount)
          }
          else {
            xml.entries.forEach(function (entry, i) {
              if (msgs.indexOf(entry.id) == -1) {
                newUnread = true;
                newText = _("msg10") + " " + entry.author_name + "\n" + _("msg11") + " " + entry.title + "\n"; // + _("msg12") + " " + entry.summary;
              }
            });
          }
          oldCount = count;
          msgs = [];
          xml.entries.forEach(function (entry, i) {
            msgs.push(entry.id);
          });
        }
        else {
          msgs = [];
          oldCount = 0;
        }

        if (!exist && req.responseText && xml.authorized == "Unauthorized") {
          normal = true;
        }
        state = false;
        
        //Gmail logged-in && has count && new count && forced
        if (exist && count && newUnread && forced) {
                                              /* xml, count, showAlert, color, message */
          if (callback) callback.apply(pointer, [xml, count, true, "red", [xml.title, count, newText]])
          return;
        }
        //Gmail logged-in && has count && new count && no force
        if (exist && count && newUnread && !forced) {
          if (callback) callback.apply(pointer, [xml, count, true, "red", [xml.title, count, newText]])
          return;
        }
        //Gmail logged-in && has count && old count && forced
        if (exist && count && !newUnread && forced) {
          if (callback) callback.apply(pointer, [xml, count, true, "red", [xml.title, count]])
          return;
        }
        //Gmail logged-in && has count && old count && no forces
        if (exist && count && !newUnread && !forced) {
          if (callback) callback.apply(pointer, [xml, count, false, "red", [xml.title, count]])
          return;
        }
        //Gmail logged-in && has no-count && new count && forced
        if (exist && !count && newUnread && forced) {
          if (callback) callback.apply(pointer, [xml, 0, false, "gray"])
          return;
        }
        //Gmail logged-in && has no-count && new count && no force
        if (exist && !count && !newUnread && !forced) {
          if (callback) callback.apply(pointer, [xml, 0, false, "gray"])
          return;
        }
        //Gmail logged-in && has no-count && old count && forced
        if (exist && !count && !newUnread && forced) {
          if (callback) callback.apply(pointer, [xml, 0, false, "gray"])
          return;
        }
        //Gmail logged-in && has no-count && old count && no forced
        if (exist && !count && !newUnread && !forced) {
          if (callback) callback.apply(pointer, [xml, 0, false, "gray"])
          return;
        }
        //Gmail not logged-in && no error && forced
        if (!exist && normal && forced) {
          if (!isRecent) open(config.email.url);
          
          if (callback) callback.apply(pointer, [xml, null, false, "unknown", 
            isRecent ? null : ["", _("msg1")]]);
          return;
        }
        //Gmail not logged-in && no error && no force
        if (!exist && normal && !forced) {
          if (callback) callback.apply(pointer, [xml, null, false, "unknown"])
          return;
        }
        //Gmail not logged-in && error && forced
        if (!exist && !normal && forced) {
          if (callback) callback.apply(pointer, [xml, null, false, "unknown", 
          isRecent ? null : [_("error") + ": ", _("msg2")]]);
          return;
        }
        //Gmail not logged-in && error && no force
        if (!exist && !normal && !forced) {
          if (callback) callback.apply(pointer, [xml, null, false, "unknown"])
          return;
        }
      });
    }
  }
}

/** checkAllMails **/
var checkAllMails = (function () {
  var len = config.email.feeds.length,
      pushCount,
      isForced,
      results = [],
      gClients = [];
  config.email.feeds.forEach(function (feed, index) {
    gClients[index] = new server.mCheck(feed, step1);
  });
  
  function step1(xml, count, alert, color, msgObj) {
    results.push({xml: xml, count: count, alert: alert, color: color, msgObj: msgObj});
    
    pushCount -= 1;
    if (!pushCount) step2();
  }
  function step2 () {
    //clear old feeds
    unreadObjs = [];
    loggedins  = [];
    //Notifications
    var text = "", tooltiptext = "", total = 0;
    var showAlert = false;
    //Sort accounts
    results.sort(function(a,b) {
      var var1, var2;
      if (prefs.alphabetic) {
        var1 = a.xml.title;
        var2 = b.xml.title;
      }
      else {
        var1 = a.xml.link;
        var2 = b.xml.link;
      }
      
      if (var1 > var2) return 1;
      if (var1 < var2) return -1;
      return 0;
    });
    //Execute
    results.forEach(function (r, i) {
      //
      if (r.msgObj) {
        if (typeof(r.msgObj[1]) == "number") {
          var label = r.xml.label;
          var msg = 
            r.msgObj[0] + (label ? "/" + label : "") + 
            " (" + r.msgObj[1] + ")" +
            (r.msgObj[2] && prefs.showDetails ? "\n" + r.msgObj[2] : "");
          if (r.alert) {
            text += (text ? " \n " : "") + msg;
          }
          tooltiptext += (tooltiptext ? "\n" : "") + msg;
          total += r.msgObj[1];
          unreadObjs.push({
            link: r.xml.link, 
            count: r.msgObj[1],
            account: r.msgObj[0] + (label ? " [" + label + "]" : label),
            entries: r.xml.entries
            });
        }
        else {
          text += (text ? " - " : "") + r.msgObj[0] + " " + r.msgObj[1];
        }
      }
      showAlert = showAlert || r.alert;
      //Menuitems
      if (r.count !== null) {
        loggedins.push({label: r.xml.title, link: r.xml.link});
      }
    });
    if (prefs.notification && (isForced || showAlert) && text) {
      notify(_("gmail"), text, true);
    }
    
    if (prefs.alert && (showAlert) && text) {
      play();
    }
    //Tooltiptext
    gButton.tooltiptext = tooltiptext ? tooltiptext : config.defaultTooltip;
    //Icon
    var isRed = false,
        isGray = false;
    results.forEach(function (r, i) {
      if (r.color == "red") isRed = true;
      if (r.color == "gray") isGray = true;
    });

    if (isRed) {
      icon(total, (isForced || showAlert) ? "new" : "red");
    }
    else if (isGray)       icon(null,  "gray");
    if (!isRed && !isGray) icon(null,  "blue");
    //Update panel if it is open
    if (contextPanel.isShowing) {
      if (unreadObjs.length) {
        contextPanel.port.emit('command', unreadObjs);
      }
      else {
        contextPanel.hide();
      }
    }
  }

  return function (forced) {
    if (forced) icon(null, "load");
  
    pushCount = len;
    results = [];
    isForced = forced;
    gClients.forEach(function(gClient, index) {
      gClient(forced, index ? true : false)
    });
  }
})();

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
  prefs.showDetails         = true;
  prefs.welcome             = true;
  prefs.searchMode          = true;
  prefs.relatedToCurrent    = true;
  prefs.size                = 0;
  prefs.currentTab          = false;
  prefs.doReadOnArchive     = true;
  prefs.soundVolume         = 100;
});

/**
 * Send archive, mark as read, mark as unread, and trash commands to Gmail server
 * @param {String} link, xml.link address
 * @param {String} cmd: rd, ur, rc_%5Ei, tr, sp
 * @param {Function} callback, callback function. True for successful action
 * @return {Object} pointer, callback apply object.
 */
var action = (function () {
  function getAt (url, callback, pointer) {
    new curl(url + "h/" + Math.ceil(1000000 * Math.random()), function (req) {
      if (!req) return;
      if(req.status == 200) {
        var tmp = /at\=([^\"\&]*)/.exec(req.responseText);
        if (callback) callback.apply(pointer, [tmp.length > 1 ? tmp[1] : null]);
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
    new curl(u, function (req) {
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

    var url = /[^\?]*/.exec(links[0].replace("http://", "https://"))[0] + "/";
    
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
    new curl(url, function (req) {
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
        new curl(url + "?ui=2&ik=" + ik + "&view=pt&search=all&th=" + thread[1], function (req) {
          var parser = Cc["@mozilla.org/xmlextras/domparser;1"]
            .createInstance(Ci.nsIDOMParser);
          var html = parser.parseFromString(req.responseText, "text/html");
          var message = html.documentElement.getElementsByClassName("message");
          var body = "...";
          try {
            body = plainText.getPlainText(message[message.length - 1].children[0].children[2]);
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
      //In linux config.image does not work properly!
      alertServ.showAlertNotification(data.url("notification.png"), title, text, clickable, link, 
        function (subject, topic, data) {
          if (topic == "alertclickcallback") {
            timer.setTimeout(function () {
              // If main window is not focused, restore it first!
              windows.active.focus();
              onCommand();
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

  pageWorker.Page({
    contentScript: "var audio = new Audio('" + path + "'); audio.volume = " + config.soundVolume + "; audio.play();",
    contentURL: data.url("sound.html")
  });
}