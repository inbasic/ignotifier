/** Require **/
var tabs             = require("sdk/tabs"),
    self             = require("sdk/self"),
    timer            = require("sdk/timers"),
    panel            = require("sdk/panel"),
    sp               = require("sdk/simple-prefs"),
    windows          = require("sdk/windows").browserWindows,
    _                = require("sdk/l10n").get,
    windowutils      = require("window-utils"),
    toolbarbutton    = require("./toolbarbutton"),
    userstyles       = require("./userstyles"),
    window           = windowutils.activeBrowserWindow,
    prefs            = sp.prefs,
    _prefs           = require("sdk/preferences/service"),
    data             = self.data,
    {Cc, Ci, Cu}     = require('chrome');

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
  get period () {return (prefs.period > 10 ? prefs.period : 10)},
  firstTime: 1,
  desktopNotification: 3,
  //Toolbar
  get textColor () {return prefs.textColor || "#000"},
  get backgroundColor () {return prefs.backgroundColor || "#FFB"},
  toolbar: {
    id: "igmail-notifier",
    move: {
      toolbarID: "nav-bar", 
      get insertbefore () {
        var id = _prefs.get(config.prefs + "nextSibling");
        return id ? id : "home-button"
      }, 
      forceMove: false
    }
  },
  defaultTooltip: _("gmail") + "\n\n" + 
    _("tooltip1") + "\n" + _("tooltip2") + "\n" + _("tooltip3"),
  //Homepage:
  homepage: "http://add0n.com/gmail-notifier.html",
  //panel
  panel: {
    width: 430,
    height: 210,
    each: 22,
    margin: 14
  },
  //Preferences
  prefs: "extensions.jid0-GjwrPchS3Ugt7xydvqVK4DQk8Ls@jetpack."
};

/** Loading style **/
userstyles.load(data.url("overlay.css"));

/** URL parser **/
function url_parse (url) {
  var temp = /^(http.*):\/\/w{0,3}\.*([^\#\?]*)[^\#]*#*([^\/]*)/.exec(url.replace("gmail", "mail.google"));
  var temp2 = /message_id\=([^&]*)/.exec(url);
  return {
    protocol: temp && temp[1] ? temp[1] : "https",
    base: temp && temp[2] ? temp[2].replace(/\/$/, '') : config.email.url,
    label: temp && temp[3] ? temp[3] : "inbox",
    id: temp2 && temp2[1] ? temp2[1] : ""
  }
}

/** Open new Tab or reuse old tabs to open the url **/
function open (url, inBackground) {
  for each(var tab in windows.activeWindow.tabs) {
    try {
      var parse1 = url_parse(tab.url),
          parse2 = url_parse(url);

      var equal = (tab.url == url || tab.url.indexOf(parse2.id) != -1);
      if (parse1.base == parse2.base) {
        if (tabs.activeTab == tab &&  equal) {
          notify(_("gmail"), _("msg8"));
        }
        else {
          tab.activate();
          if (!equal) {
            tab.url = url;
          }
        }
        return;
      }
    } catch(e) {
      console.error(e);
    }
  }
  tabs.open({url: url, inBackground: inBackground ? inBackground : false});
}

/** Multi email Panel **/
var contextPanel = panel.Panel({
  width: config.panel.width,
  height: config.panel.height,
  position: {
    top: 0,
    right: 30
  },
  contentURL: data.url("context.html"),
  contentScriptFile: data.url("context.js")
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
});
contextPanel.port.on("update", function () {
  tm.reset(true);
});

/** onCommand **/
var onCommand = function (e, tbb, link) {
  if (!unreadObjs.length) {
    open(config.email.url);
  }
  else if (unreadObjs.length == 1 && prefs.oldFashion == "1") {
    open(unreadObjs[0].link);
  }
  else {
    //For test purposes
    try {
      contextPanel.show(tbb);
    }
    catch (e) {
      contextPanel.show(null, tbb);
    }
    contextPanel.port.emit('command', unreadObjs);
  }
}

/** Toolbar button **/
gButton = toolbarbutton.ToolbarButton({
  id: config.toolbar.id,
  label: _("gmail"),
  tooltiptext: config.defaultTooltip,
  backgroundColor: config.backgroundColor,
  textColor: config.textColor,
  onClick: function (e) { //Linux problem for onClick
    if (e.button == 1 || (e.button == 0 && e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      tm.reset(true);
    }
  },
  onContext: (function () {
    var installed = false;
    return function (e, menupopup, _menuitem) {
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
        menupopup.removeChild(menupopup.firstChild)
      }
      function addChild (label, value) {
        var item = _menuitem.cloneNode(true);
        item.setAttribute("label", label);
        item.setAttribute("value", value);
        menupopup.appendChild(item);
      }
      if (temp.length) {
        temp.forEach(function (obj) {
          addChild(obj.label, obj.link);
        });
      }
      else {
        addChild(_("context"), "");
      }
    }
  })(),
  onCommand: onCommand
});

/** icon designer**/
var icon = function (number, clr) {
  gButton.loadMode = false;
  gButton.badge = (number < 10) ? number : "+";
  if (prefs.clrPattern == 0) {
    gButton.color = clr;
  }
  else {  //Support for reverse coloring
    switch (clr) {
      case "blue":
        gButton.color = "gray";
        break;
      case "gray":
        gButton.color = "blue";
        break;
      default:
        gButton.color = clr;
    }
  }
}
icon(null, "blue");

/** Initialize **/
var OS, tm, gButton, unreadObjs = [], loggedins  = [];
exports.main = function(options, callbacks) {
  //OS detection, required by sound
  var runtime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
  OS = runtime.OS;
  //Timer
  tm = manager (config.firstTime * 1000, checkAllMails);
  //Install
  if (options.loadReason == "install" || prefs.forceVisible) {
    //If adjacent button is restartless wait for its creation
    timer.setTimeout(function (){
      gButton.moveTo(config.toolbar.move);
    }, 800);
  }
  //Welcome page
  if (options.loadReason == "upgrade" || options.loadReason == "install") {
    welcome();
  }
};

/** Store toolbar button position **/
var aWindow = windowutils.activeBrowserWindow;
var aftercustomizationListener = function () {
  let button = aWindow.document.getElementById(config.toolbar.id);
  if (!button) return;
  _prefs.set(config.prefs + "nextSibling", button.nextSibling.id);
}
aWindow.addEventListener("aftercustomization", aftercustomizationListener, false);
exports.onUnload = function (reason) {
  aWindow.removeEventListener("aftercustomization", aftercustomizationListener, false); 
}

/** Prefs Listener**/
sp.on("textColor", function () {
  gButton.textColor = config.textColor;
});
sp.on("backgroundColor", function () {
  gButton.backgroundColor = config.backgroundColor;
});
sp.on("clrPattern", function () {
  tm.reset();
});

/** Interval manager **/
var manager = function (once, func) {
  var _timer, fisrt = true;
  function run (t1, param) {
    _timer = timer.setTimeout(function () {
      func(fisrt ? param : null);
      fisrt = false;
      run(t1);
    }, fisrt ? t1 : config.period * 1000);
  }
  run(once);
  
  return {
    reset: function (forced) {
      timer.clearTimeout(_timer);
      fisrt = true;
      run(0, forced);
    }
  }
};

/** User's actions **/
tabs.on('ready', function (tab) {
  if (/mail\.google\.com/.test(tab.url)) {
    tm.reset();
  }
});
/** Welcome page **/
var welcome = function () {
  timer.setTimeout(function () {
    open(config.homepage);
  }, 3000);
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
    return {
      get fullcount () {
        var temp = 0;
        try {
          var tags = xml.getElementsByTagName("fullcount");
          if (tags.length) {
            temp = parseInt(tags[0].childNodes[0].nodeValue);
          }
          else { //atom does not provide fullcount attribute
            temp = xml.getElementsByTagName("entry").length;
          }
        } catch(e){}
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
          label = this.label;
          var id = /u\/\d/.exec(feed);  //Sometimes id is wrong in the feed structure!
          temp = xml.getElementsByTagName("link")[0].getAttribute("href");
          if (id.length) {
            temp = temp.replace(/u\/\d/, id[0]);
          };
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
              return entry.getElementsByTagName("link")[0].getAttribute("href")
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

      var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
        .createInstance(Ci.nsIXMLHttpRequest);
      req.mozBackgroundRequest = true;  //No authentication
      req.open('GET', feed, true);
      req.onreadystatechange = function () {
        if (req.readyState != 4) return;
        var xml = new server.parse(req, feed);
        
        var count = 0;
        var normal = false; //not logged-in but normal response from gmail
        var newUnread = false;
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
          if (callback) callback.apply(pointer, [xml, count, true, "red", [xml.title, count]])
          return;
        }
        //Gmail logged-in && has count && new count && no force
        if (exist && count && newUnread && !forced) {
          if (callback) callback.apply(pointer, [xml, count, true, "red", [xml.title, count]])
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
      }
      // https://github.com/inbasic/ignotifier/issues/29
      req.channel.QueryInterface(Ci.nsIHttpChannelInternal).forceAllowThirdPartyCookie = true;
      req.send(null);
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
    var singleLink = null;
    results.forEach(function (r, i) {
      //
      if (r.msgObj) {
        if (typeof(r.msgObj[1]) == "number") {
          var label = r.xml.label;
          var msg = r.msgObj[0] + (label ? "/" + label : "") + " (" + r.msgObj[1] + ")";
          if (r.alert) {
            text += (text ? " - " : "") + msg;
            if (singleLink === null) {
              singleLink = r.xml.link;
            }
            else {
              singleLink = "";
            }
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
      notify(_("gmail"), text, singleLink ? true : false, singleLink);
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

    if (isRed)             icon(total, "red");
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
    if (forced) gButton.loadMode = true;
  
    pushCount = len;
    results = [];
    isForced = forced;
    gClients.forEach(function(gClient, index){
      gClient(forced, index ? true : false)
    });
  }
})();

/** Prefs **/
sp.on("reset", function() {
  if (!window.confirm(_("msg7"))) return
  prefs.backgroundColor   = "#FFB";
  prefs.textColor         = "#000";
  prefs.alphabetic        = false;
  prefs.alert             = true;
  prefs.notification      = true;
  prefs.period            = 15;
  prefs.feeds             = config.email.FEEDS;
  prefs.soundNotification = 1;
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
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Ci.nsIXMLHttpRequest);
    req.mozBackgroundRequest = true;  //No authentication
    req.open('GET', url + "h/" + Math.ceil(1000000 * Math.random()), true);
    req.onreadystatechange = function (aEvt) {
      if (req.readyState == 4) {
        if(req.status == 200) {
          var tmp = /at\=([^\"\&]*)/.exec(req.responseText);
          if (callback) callback.apply(pointer, [tmp.length > 1 ? tmp[1] : null]);
        }
        else {
          if (callback) callback.apply(pointer, [null]);
        }
      }
    };
    req.channel.QueryInterface(Ci.nsIHttpChannelInternal)
      .forceAllowThirdPartyCookie = true;
    req.send(null);
  }
  function sendCmd (url, at, thread, cmd, callback, pointer) {
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Ci.nsIXMLHttpRequest);
    req.mozBackgroundRequest = true;  //No authentication
    req.open('POST', url + "?at=" + at + "&act=" + cmd + "&t=" + thread, true);
    req.onreadystatechange = function (aEvt) {
      if (req.readyState == 4) {
        if(req.status == 200) {
          if (callback) callback.apply(pointer, [true]);
        }
        else {
          if (callback) callback.apply(pointer, [false]);
        }
      }
    };
    req.channel.QueryInterface(Ci.nsIHttpChannelInternal)
      .forceAllowThirdPartyCookie = true;
    req.send(null);
  }
  
  return function (link, cmd, callback, pointer) {
    link = link.replace("http://", "https://");
    var url = /[^\?]*/.exec(link)[0] + "/";
    
    getAt(url, function (at) {
      if (at) {
        var thread = /message\_id\=([^\&]*)/.exec(link);
        if (thread.length > 1) {
          sendCmd(url, at, thread[1], cmd, function () {
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
            onCommand(null, null, link);
          }
        }, "");
    }
    catch(e) {
      let browser = windowutils.activeBrowserWindow.gBrowser,
          notificationBox = browser.getNotificationBox();

      notification = notificationBox.appendNotification(text, 'jetpack-notification-box',
          data.url("notification.png"), notificationBox.PRIORITY_INFO_MEDIUM, []
      );
      timer.setTimeout(function() {
          notification.close();
      }, config.desktopNotification * 1000);
    }
  }
})();

/** Player **/
var play = function () {
  let sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
  let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  switch (prefs.soundNotification) {
    case 0:
      sound.playEventSound(OS == "Linux" ? 1 : 0);
      break;
    case 1:
      sound.play(ios.newURI(data.url("alert.wav"), null, null));
      break;
    case 2:
      try {
        let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(prefs.sound);
        sound.play(ios.newFileURI(file));
      }
      catch(e) {
        timer.setTimeout(function (){
          notify(_("gmail"), _("msg9"));
        }, 500);
      }
  }
}