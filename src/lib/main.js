var tabs = require("tabs"),
    self = require("self"),
    timer = require("timers"),
    notifications = require("notifications"),
    toolbarbutton = require("toolbarbutton"),
    _ = require("l10n").get,
    data = self.data,
    {XMLHttpRequest} = require("xhr"),
    {Cc, Ci, Cu} = require('chrome');
/* Internal options */
var options = {
  email: {
    feeds: [
      "https://mail.google.com/mail/u/0/feed/atom", 
      "https://mail.google.com/mail/u/1/feed/atom",
      "https://mail.google.com/mail/u/2/feed/atom",
      "https://mail.google.com/mail/u/3/feed/atom"
    ],
    url: "https://www.gmail.com"
  },
  move: {
    toolbarID: "nav-bar", 
    forceMove: false
  },
  period: 15,
  firstTime: 1
};
/* Initialize */
var gmail, clock;
exports.main = function() {
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
      tabs.open({url: options.email.url, inBackground: false});
    }
  });
  //Timer
  timer.setInterval(function () {
    checkAllMails();
  }, options.period * 1000);
  timer.setTimeout(function () {
    checkAllMails();
  }, options.firstTime * 1000);
  //Install
  if (options.loadReason == "install") {
    gmail.moveTo(options.move);
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
      var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
      xml = parser.parseFromString(req.responseText, "text/xml");
    }
    return {
      get fullcount () {
        return parseInt(xml.getElementsByTagName("fullcount")[0].childNodes[0].nodeValue)
      },
      get title () {
        var temp = xml.getElementsByTagName("title")[0].childNodes[0].nodeValue;
        try {
          temp = temp.match(/[^ ]+@.+\.[^ ]+/)[0];
        } catch(e) {}
        return temp;
      },
      get authorized () {
        return xml.getElementsByTagName("TITLE")[0].childNodes[0].nodeValue;
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
        msgs = [];
    /*
     * forced: is this a forced check?
     * isRecent: did user recently receive a notification?
     */
    return function (forced, isRecent) {
      //Check state
      if (state && !forced) { 
        console.log("Gmail notifier listening at " + feed + " is busy right now. Try it later, or try force option")
        return;
      }
      if (state && forced) {
        console.log("Gmail notifier was busy, but this is a forced command.")
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
        //console.log(exist + " " + count + " " + normal + " " + newUnread);

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
          if (!isRecent) tabs.open(options.email.url);
          
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
          notifier(_("error"), _("msg2"));
          
          if (callback) callback.apply(pointer, [xml, null, false, "unknown"])
          return;
        }
        //Gmail not logged-in && error && no force
        if (!exist && !normal && !forced) {
          if (callback) callback.apply(pointer, [xml, null, false, "unknown"])
          return;
        }
        console.log("Gmail Notifier: Some unpredicted condition just happend!");
      }
      req.send(null);
    }
  }
}
/* checkAllMails */
var checkAllMails = (function () {
  var len = options.email.feeds.length,
      pushCount,
      isForced,
      results = [],
      gClients = [];
  options.email.feeds.forEach(function (feed, index) {
    gClients[index] = new server.mCheck(feed, step1);
  });
  
  function step1(xml, count, alert, color, msgObj) {
    results.push({xml: xml, count: count, alert: alert, color: color, msgObj: msgObj});
    
    pushCount -= 1;
    if (!pushCount) step2();
  }
  function step2 () {
    //Notifications
    var text = "", tooltiptext = "";
    var showAlert = isForced;
    results.forEach(function (r, i) {
      if (r.msgObj) {
        if (typeof(r.msgObj[1]) == "number") {
          if (r.alert) text += (text ? " - " : "") + r.msgObj[0] + " (" + r.msgObj[1] + ")";
          tooltiptext += (tooltiptext ? "\n" : "") + r.msgObj[0] + " (" + r.msgObj[1] + ")";
        }
        else {
          text += (text ? " - " : "") + r.msgObj[0] + " " + r.msgObj[1];
        }
      }
      showAlert = showAlert || r.alert;
    });
    if (showAlert && text) {
      notify(_("gmail"), text);
      play();
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
    if (isRed) gButton.image = data.url("gmail[R].png");
    else if (isGray) gButton.image = data.url("gmail[G].png");
    if (!isRed && !isGray) gButton.image = data.url("gmail[U].png");
  }

  return function (forced) {
    if (forced) gButton.image = data.url("load.gif");
  
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
      iconURL: data.url("gmail[R].png")
    });
  }
})();
/* Player */
var play = function () {
  var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
  sound.playEventSound(0);
}