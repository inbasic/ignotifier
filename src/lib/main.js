var tabs = require("tabs"),
    self = require("self"),
    timer = require("timers"),
    window = require("window-utils").activeBrowserWindow,
    prefs = require("simple-prefs").prefs,
    notifications = require("notifications"),
    toolbarbutton = require("toolbarbutton"),
    _ = require("l10n").get,
    data = self.data,
    {XMLHttpRequest} = require("xhr"),
    {Cc, Ci, Cu} = require('chrome');
/* Internal config */
const FEED = "https://mail.google.com/mail/u/%d/feed/atom";
const URL = "https://www.gmail.com";
var config = {
  //Gmail
  email: {
    feeds: [
      (prefs.feed || FEED).replace("%d", 0), 
      (prefs.feed || FEED).replace("%d", 1), 
      (prefs.feed || FEED).replace("%d", 2), 
      (prefs.feed || FEED).replace("%d", 3)
    ],
    url: prefs.url || URL
  },
  //Timing
  period: (prefs.period > 10 ? prefs.period : 10),
  firstTime: 1,
  //Toolbar
  image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAIAAAAy3EnLAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwQAADsEBuJFr7QAAABp0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTAw9HKhAAAAgklEQVQoU22QsRWAIAxE2YpZ3IZp2CDDWKaztbPieXAQQcKjQPN/LhDOGLnvlJ6c3Y2SYcFOOBSRsi+RmekCelzH4TiNRslCuoC+jjPRAJjzCX9npX0Bd7Acm8QutiWo4onM4dz4rD9VtwTSrcDZKs01SkvCTDsv25x1pNHboUcOhRfmUFFAGpPmbQAAAABJRU5ErkJggg==",
  textColor: prefs.textColor || "#000",
  backgroundColor: prefs.backgroundColor || "#FF0",
  move: {
    toolbarID: "nav-bar", 
    forceMove: false
  },
  //
  debug: false
};
/* Initialize */
var gButton, clock;
exports.main = function(options, callbacks) {
  //Gmail button
  gButton = toolbarbutton.ToolbarButton({
    id: "igmail-notifier",
    label: _("gmail"),
    tooltiptext: _("gmail") + "\n\n" + _("tooltip1") + "\n" + _("tooltip2"),
    image: data.url("gmail[U].png"),
    onClick: function (e) {
      if (e.button == 1 || e.button == 2) {
        checkAllMails(true);
      }
    },
    onCommand: function () {
      if (!emailFeeds.length) {
        tabs.open({url: config.email.url.replace("%d", 0), inBackground: false});
      }
      else if (emailFeeds.length == 1) {
        tabs.open({url: config.email.url.replace("%d", emailFeeds[0][0]), inBackground: false});
      }
      else {
        var items = [];
        console.log(emailFeeds);
        emailFeeds.sort(function (a, b) {return a[0] > b[0]});
        emailFeeds.forEach(function (identifier){items.push(identifier[1])});
        var rtn = prompts(_("msg4"), _("msg5"), items);
        if (rtn[0]) {
          tabs.open({url: config.email.url.replace("%d", rtn[1]), inBackground: false});
        }
      }
    }
  });
  //Timer
  timer.setInterval(function () {
    checkAllMails();
  }, config.period * 1000);
  timer.setTimeout(function () {
    checkAllMails();
  }, config.firstTime * 1000);
  //Install
  if (options.loadReason == "install") {
    gButton.moveTo(config.move);
  }
};
/* Server */
var server = {
  parse: function (req) {
    var xml;
    if (req.responseXML) {
      xml = req.responseXML;
    }
    else {
      if (!req.responseText) return;
      
      var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
      xml = parser.parseFromString(req.responseText, "text/xml");
    }
    return {
      get fullcount () {
        var temp = 0;
        try {temp = parseInt(xml.getElementsByTagName("fullcount")[0].childNodes[0].nodeValue)} catch(e){}
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
      get authorized () {
        var temp = "";
        try {temp = xml.getElementsByTagName("TITLE")[0].childNodes[0].nodeValue;} catch(e){}
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
  mCheck: function (identifier, feed, callback, pointer) {
    var state = false,
        msgs = [];
    /*
     * forced: is this a forced check?
     * isRecent: did user recently receive a notification?
     */
    return function (forced, isRecent) {
      //Check state
      if (state && !forced) { 
        debug("[Warning] Gmail notifier listening at " + feed + " is busy right now. Try it later, or try the force option.");
        return;
      }
      if (state && forced) {
        debug("[Warning] Gmail notifier was busy. But this is a forced command.");
      }
      //Initialazing
      state = true;
      var req = new XMLHttpRequest();
      req.open('GET', feed, true);
      req.onreadystatechange = function () {
        if (req.readyState != 4) return;
        var xml = new server.parse(req);
        
        var count = 0;
        var normal = false; //not logged-in but normal response from gmail
        var newUnread = false;
        var exist = req.status == 200;  //Gmail account is loged-in
        if (exist) {
          count = xml.fullcount;
          xml.enteries.forEach(function (entry, i) {
            var id = entry.getElementsByTagName("id")[0].childNodes[0].nodeValue;
            if (msgs.indexOf(id) == -1) {
              newUnread = true;
            }
          });
          msgs = [];
          xml.enteries.forEach(function (entry, i) {
            msgs.push(entry.getElementsByTagName("id")[0].childNodes[0].nodeValue);
          });
        }
        else {
          msgs = [];
        }

        if (!exist && req.responseText && xml.authorized == "Unauthorized") {
          normal = true;
        }
        state = false;
        //Gmail logged-in && has count && new count && forced
        if (exist && count && newUnread && forced) {
                                              /* xml, count, showAlert, color, message */
          if (callback) callback.apply(pointer, [identifier, xml, count, true, "red", [xml.title, count]])
          return;
        }
        //Gmail logged-in && has count && new count && no force
        if (exist && count && newUnread && !forced) {
          if (callback) callback.apply(pointer, [identifier, xml, count, true, "red", [xml.title, count]])
          return;
        }
        //Gmail logged-in && has count && old count && forced
        if (exist && count && !newUnread && forced) {
          if (callback) callback.apply(pointer, [identifier, xml, count, true, "red", [xml.title, count]])
          return;
        }
        //Gmail logged-in && has count && old count && no forces
        if (exist && count && !newUnread && !forced) {
          if (callback) callback.apply(pointer, [identifier, xml, count, false, "red", [xml.title, count]])
          return;
        }
        //Gmail logged-in && has no-count && new count && forced
        if (exist && !count && newUnread && forced) {
          if (callback) callback.apply(pointer, [identifier, xml, 0, false, "gray"])
          return;
        }
        //Gmail logged-in && has no-count && new count && no force
        if (exist && !count && !newUnread && !forced) {
          if (callback) callback.apply(pointer, [identifier, xml, 0, false, "gray"])
          return;
        }
        //Gmail logged-in && has no-count && old count && forced
        if (exist && !count && !newUnread && forced) {
          if (callback) callback.apply(pointer, [identifier, xml, 0, false, "gray"])
          return;
        }
        //Gmail logged-in && has no-count && old count && no forced
        if (exist && !count && !newUnread && !forced) {
          if (callback) callback.apply(pointer, [identifier, xml, 0, false, "gray"])
          return;
        }
        //Gmail not logged-in && no error && forced
        if (!exist && normal && forced) {
          if (!isRecent) tabs.open(config.email.url.replace("%d", 0));
          
          if (callback) callback.apply(pointer, [identifier, xml, null, false, "unknown", 
            isRecent ? null : ["", _("msg1")]]);
          return;
        }
        //Gmail not logged-in && no error && no force
        if (!exist && normal && !forced) {
          if (callback) callback.apply(pointer, [identifier, xml, null, false, "unknown"])
          return;
        }
        //Gmail not logged-in && error && forced
        if (!exist && !normal && forced) {
          if (callback) callback.apply(pointer, [identifier, xml, null, false, "unknown", 
          isRecent ? null : [_("error"), _("msg2")]]);
          return;
        }
        //Gmail not logged-in && error && no force
        if (!exist && !normal && !forced) {
          if (callback) callback.apply(pointer, [identifier, xml, null, false, "unknown"])
          return;
        }
        debug("Gmail Notifier: Some unpredicted condition just happend: exist:" + exist + " count:" + count + " normal:" + normal + " newUnread:" + newUnread);
      }
      req.send(null);
    }
  }
}
/* checkAllMails */
var emailFeeds = [];

var checkAllMails = (function () {
  var len = config.email.feeds.length,
      pushCount,
      isForced,
      results = [],
      gClients = [];
  config.email.feeds.forEach(function (feed, index) {
    gClients[index] = new server.mCheck(index, feed, step1);
  });
  
  function step1(identifier, xml, count, alert, color, msgObj) {
    results.push({identifier: identifier, xml: xml, count: count, alert: alert, color: color, msgObj: msgObj});
    
    pushCount -= 1;
    if (!pushCount) step2();
  }
  function step2 () {
    //clear old feeds
    emailFeeds = [];
    //Notifications
    var text = "", tooltiptext = "", total = 0;
    var showAlert = isForced;
    results.forEach(function (r, i) {
      if (r.msgObj) {
        if (typeof(r.msgObj[1]) == "number") {
          if (r.alert) text += (text ? " - " : "") + r.msgObj[0] + " (" + r.msgObj[1] + ")";
          tooltiptext += (tooltiptext ? "\n" : "") + r.msgObj[0] + " (" + r.msgObj[1] + ")";
          total += r.msgObj[1];
          
          emailFeeds.push([r.identifier, r.msgObj[0]]);
        }
        else {
          text += (text ? " - " : "") + r.msgObj[0] + " " + r.msgObj[1];
        }
      }
      showAlert = showAlert || r.alert;
    });
    if (showAlert && text) {
      if (prefs.notification) notify(_("gmail"), text);
      if (prefs.alert) play();
    }
    //Tooltiptext
    gButton.tooltiptext = tooltiptext ? tooltiptext : _("gmail") + "\n\n" + _("tooltip1") + "\n" + _("tooltip2");
    //Icon
    var isRed = false,
        isGray = false;
    results.forEach(function (r, i) {
      if (r.color == "red") isRed = true;
      if (r.color == "gray") isGray = true;
    });
    if (isRed) {
      var svg = 
        "<svg height='16' width='20' xmlns:xlink='http://www.w3.org/1999/xlink' xmlns='http://www.w3.org/2000/svg'>" +
          "<image x='0' y='3' height='10' width='16' xlink:href='" + config.image + "'></image>" +
          "<circle cx='15' cy='11' r='5' fill='" + config.backgroundColor + "'/>" +
          "<text x='12' y='15' font-size='10' font-family='Arial' font-weight='bold' fill='" + config.textColor + "'>%d</text>" +
        "</svg>";
      gButton.image = "data:image/svg+xml;base64," + window.btoa(svg.replace("%d", total < 10 ? total : "+"));
    }
    else if (isGray) gButton.image = data.url("gmail[G].png");
    if (!isRed && !isGray) gButton.image = data.url("gmail[U].png");
  }

  return function (forced) {
    if (forced) gButton.image = data.url("load.png");
  
    pushCount = len;
    results = [];
    isForced = forced;
    gClients.forEach(function(gClient, index){gClient(forced, index ? true : false)});
  }
})();
/* Notifier */
var notify = (function () {
  return function (title, text) {
    notifications.notify({
      title: title, 
      text: text,
      iconURL: data.url("notification.png")
    });
  }
})();
/* Player */
var play = function () {
  var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
  sound.playEventSound(0);
}
/* Debuger */
var debug = function (text) {
  if (config.debug) {
    console.log(text);
  }
}
/* Prompt */
var prompts = (function () {
  var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
  return function (title, content, items) {
    var selected = {};
    var result = prompts.select(null, title, content, items.length, items, selected);
    return [result, selected.value];
  }
})();

