var isFirefox = typeof require !== 'undefined';
if (isFirefox) {
  app = require('../wrapper/firefox/app');
  config = require('../config');
  render = require('./render');
  gmail = exports;
}
else {
  var gmail = {};
}

gmail.body = (function () {
  var iks = {}, contents = {};

  function getIK (url) {
    if (iks[url]) {
      return app.Promise.resolve(iks[url]);
    }
    return new app.get(url).then(function (req) {
      var tmp = /var GLOBALS\=\[(?:([^\,]*)\,){10}/.exec(req.responseText || "");
      var ik = tmp && tmp.length > 1 ? tmp[1].replace(/[\"\']/g, "") : null;
      if (ik) {
        console.error("getIK", ik);
        iks[url] = ik;
        return ik;
      }
      else {
        return Error("gmail.js -> body -> getIK -> Error at resolving user's static ID. Please switch back to the summary mode.");
      }
    });
  }

  return function (link) {
    link = link.replace("http://", "https://");
    if (contents[link]) {
      return app.Promise.resolve(contents[link]);
    }

    var url = /[^\?]*/.exec(link)[0] + "/";
    var thread = /message\_id\=([^\&]*)/.exec(link);
    if (!thread.length) {
      return app.Promise.reject(Error('gmail.js -> body -> Error at resolving thread. Please switch back to the summary mode.'));
    }
    return getIK(url).then(function (ik) {
      return new app.get(url + "?ui=2&ik=" + ik + "&view=pt&search=all&th=" + thread[1]).then(function (req) {
        var body = render[config.popup.display ? "getHTMLText" : "getPlainText"](req, url);
        contents[link] = body;
        return body;
      });
    });
  }
})();



/**
 * Send archive, mark as read, mark as unread, and trash commands to Gmail server
 * @param {String} link, xml.link address
 * @param {String} cmd: rd, ur, rc_%5Ei, tr, sp
 */
gmail.action = (function () {
  function getAt_2 (url) {
    return new app.get(url + "h/" + Math.ceil(1000000 * Math.random())).then (function (req) {
      if (!req) {
        return Error("gmail.js -> action -> getAt_2 -> server response is empty.");
      }
      if(req.status == 200) {
        var tmp = /at\=([^\"\&]*)/.exec(req.responseText);
        console.error("getAt_2", tmp[1]);
        return tmp && tmp.length > 1 ? tmp[1] : null;
      }
      else {
        return Error("gmail.js -> action -> getAt_2 -> got status of " + req.status);
      }
    });
  }
  function getAt (url) {
    return new app.get(url).then(function (req) {
      if (!req) {
        return Error("gmail.js -> action -> getAt -> server response is empty.");
      }
      if(req.status == 200) {
        var tmp = /GM_ACTION_TOKEN\=\"([^\"]*)\"/.exec(req.responseText);
        if (tmp && tmp.length) {
          console.error("getAt", tmp[1]);
          return tmp[1];
        }
        else {
          return getAt_2(url);
        }
      }
      else {
        return Error("gmail.js -> action -> getAt -> got status of " + req.status);
      }
    });
  }

  function sendCmd (url, at, threads, cmd) {
    if (cmd == "rc_%5Ei" && config.email.doReadOnArchive) {
      sendCmd(url, at, threads, "rd");
    }
    var u = url + "?at=" + at + "&act=" + cmd.replace("rd-all", "rd");
    u += "&t=" + threads.join("&t=");

    return new app.get(u).then(function (req) {
      if (!req) {
        return Error("gmail.js -> action -> sendCmd -> server response is empty.");
      }
      if (req.status === 200) {
        return true;
      }
      return Error("gmail.js -> action -> sendCmd -> got status of " + req.status);
    });
  }

  return function (links, cmd) {
    links = typeof(links) === "string" ? [links] : links;
    var url = /[^\?]*/.exec(links[0])[0] + "/";
    return getAt(url).then(function (at) {
      var threads = [];
      links.forEach(function (link) {
        var thread = /message\_id\=([^\&]*)/.exec(link);
        if (thread && thread.length) {
          threads.push(thread[1]);
        }
      });
      if (threads.length) {
        return sendCmd(url, at, threads, cmd);
      }
      return app.Promise.reject(Error("gmail.js -> action -> Error at resolving thread."));
    });
  }
})();
