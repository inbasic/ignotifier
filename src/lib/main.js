/** Require **/
var tabs             = require("sdk/tabs"),
    self             = require("sdk/self"),
    timer            = require("sdk/timers"),
    panel            = require("sdk/panel"),
    pb               = require("sdk/private-browsing"),
    sp               = require("sdk/simple-prefs"),
    windows          = require("sdk/windows").browserWindows,
    _                = require("sdk/l10n").get,
    toolbarbutton    = require("toolbarbutton"),
    windowutils      = require("window-utils"),
    window           = windowutils.activeBrowserWindow,
    prefs            = sp.prefs,
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
  color: {
    get red () {return prefs.red},
    get blue () {return prefs.blue},
    get gray () {return prefs.gray}
  },
  image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuA" +
  "AAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwAAADsABataJCQAAABp0RVh0U29mdHdhcmUAUGF" +
  "pbnQuTkVUIHYzLjUuMTAw9HKhAAAAiUlEQVQoU3WRsRWAIAxE2YpZ2IZp2IBhLNPZ2lnxPAicI" +
  "JFHgeR/LqA7vNd5xXinZE6UiDmusCg5l33kPDNdwBlnCIbTaJQY0gWcazgTDUBzXuHrrLQt4A7" +
  "MYSe82JYggieio33js26KbAlKt4L2Vmkdo7QkzLTxss1ZWxpnG/TI+Sb8/Wbuq/AAklNxjGS0d" +
  "nUAAAAASUVORK5CYII=",
  get textColor () {return prefs.textColor || "#000"},
  get backgroundColor () {return prefs.backgroundColor || "#FFB"},
  move: {toolbarID: "nav-bar", forceMove: false},
  defaultTooltip: _("gmail") + "\n\n" + _("tooltip1") + "\n" + _("tooltip2") + "\n" + _("tooltip3"),
  //Homepage:
  homepage: "http://ignotifier1.notlong.com/",
  //panel
  panel: {
    width: 230,
    each: 22,
    margin: 14
  }
};

/** URL parser **/
function url_parse (url) {
  var temp = /^(http.*):\/\/w{0,3}\.*([^\#\?]*)[^\#]*#*([^\/]*)/.exec(url.replace("gmail", "mail.google"));

  return {
    protocol: temp[1] ? temp[1] : "https",
    base: temp[2] ? temp[2].replace(/\/$/, '') : config.email.url,
    label: temp[3] ? temp[3] : "inbox"
  }
}

/** Open new Tab or reuse old tabs to open the url **/
function open (url, inBackground) {
  for each(var tab in windows.activeWindow.tabs) {
    try {
      var parse1 = url_parse(tab.url),
          parse2 = url_parse(url);
      
      if (parse1.base == parse2.base && parse1.label == parse2.label) {
        if (tabs.activeTab == tab) {
          notify(_("gmail"), _("msg8"));
        }
        else {
          tab.activate();
        }
        return;
      }
    }catch(e) {}
  }
  tabs.open({url: url, inBackground: inBackground ? inBackground : false});
}

/** icon designer**/
var icon = function (number, code) {
  code = code + "";
  var hueRotate = 0, saturate = 1;
  switch (code) {
    case "0": // Blue
      hueRotate = -140; 
      saturate = 1
      break;
    case "1": // Brown
      hueRotate = 40;
      saturate = 1
      break;  
    case "2": // Gray
      hueRotate = 0; 
      saturate = 0;
      break;
    case "3": // Green
      hueRotate = 130;
      saturate = 1;
      break;
    case "4": // Pink
      hueRotate = -50;
      saturate = 1;
      break;
    case "5": // Purple
      hueRotate = -100;
      saturate = 1;
      break;
    case "6": // Red
      hueRotate = 0;
      saturate = 1;
  }
  
  gButton.loadMode = false;
  gButton.badge = (number < 10) ? number : "+";
  gButton.hueRotate = hueRotate;
  gButton.saturate = saturate;
}

/** Multi email Panel **/
var contextPanel = panel.Panel({
  width: config.panel.width,
  contentURL: data.url("context.html"),
  contentScriptFile: data.url("context.js")
});
contextPanel.port.on("click", function (link) {
  contextPanel.hide();
  if (link) open(link);
})

/** onCommand **/
var onCommand = function (e, tbb, link) {
  if (!unreadObjs.length) {
    open(config.email.url);
  }
  else if (unreadObjs.length == 1) {
    open(unreadObjs[0].link);
  }
  else if (link) {
    open(link);
  }
  else {
    //contextPanel.height = config.panel.each * unreadObjs.length + config.panel.margin;
    contextPanel.port.emit('list', unreadObjs);
    contextPanel.show(tbb);
  }
}

/** Initialize **/
var OS, tm, gButton, unreadObjs = [], loggedins  = [];
exports.main = function(options, callbacks) {
  //OS detection, required by sound
  var runtime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
  OS = runtime.OS;
  //Gmail button
  gButton = toolbarbutton.ToolbarButton({
    id: "igmail-notifier",
    label: _("gmail"),
    tooltiptext: config.defaultTooltip,
    backgroundColor: config.backgroundColor,
    textColor: config.textColor,
    loadImage: data.url("load.png"),
    image: config.image,
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
  //
  icon(null, config.color.blue);
  //Timer
  tm = manager (config.firstTime * 1000, 
    config.period * 1000, 
    checkAllMails);
  //Install
  if (options.loadReason == "install") {
    gButton.moveTo(config.move);
  }
  //Welcome page
  if (options.loadReason == "upgrade" || options.loadReason == "install") {
    welcome();
  }
  //Prefs
  sp.on("textColor", function () {
    gButton.textColor = config.textColor;
  });
  sp.on("backgroundColor", function () {
    gButton.backgroundColor = config.backgroundColor;
  });
  
};

/** Interval manager **/
var manager = function (once, period, func) {
  var _timer, fisrt = true;
  function run (t1, t2, param) {
    _timer = timer.setTimeout(function () {
      func(fisrt ? param : null);
      fisrt = false;
      run(t1, t2);
    }, fisrt ? t1 : t2);
  }
  run(once, period);
  
  return {
    reset: function (forced) {
      timer.clearTimeout(_timer);
      fisrt = true;
      run(0, period, forced);
    }
  }
};

/** User's actions **/
tabs.on('ready', function (tab) {
  if (/mail\.google\.com/.test(tab.url)) {
    tm.reset();
  }
});
pb.on("start", function() {
  tm.reset();
});
pb.on("stop", function() {
  tm.reset();
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
      get enteries () {
        return Array.prototype.slice.call( xml.getElementsByTagName("entry") ) 
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
            xml.enteries.forEach(function (entry, i) {
              var id = entry.getElementsByTagName("id")[0].childNodes[0].nodeValue;
              if (msgs.indexOf(id) == -1) {
                newUnread = true;
              }
            });
          }
          oldCount = count;
          msgs = [];
          xml.enteries.forEach(function (entry, i) {
            msgs.push(entry.getElementsByTagName("id")[0].childNodes[0].nodeValue);
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
            account: r.msgObj[0] + (label ? " [" + label + "]" : label)
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

    if (isRed)             icon(total, config.color.red);
    else if (isGray)       icon(null, config.color.gray);
    if (!isRed && !isGray) icon(null, config.color.blue);
  }

  return function (forced) {
    if (forced) gButton.loadMode = true;
  
    pushCount = len;
    results = [];
    isForced = forced;
    gClients.forEach(function(gClient, index){gClient(forced, index ? true : false)});
  }
})();

/** Prefs **/
sp.on("reset", function() {
  if (!window.confirm(_("msg7"))) return
  prefs.backgroundColor = "#FFB";
  prefs.textColor       = "#000";
  prefs.alphabetic      = false;
  prefs.alert           = true;
  prefs.notification    = true;
  prefs.period          = 15;
  prefs.feeds           = config.email.FEEDS;
  prefs.red             = 6;
  prefs.gray            = 2;
});

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
  sound.playEventSound(OS == "Linux" ? 1 : 0);
}