var background = {}, manifest = {},
  isFirefox = typeof self !== 'undefined' && self.port,
  isSafari = typeof safari !== 'undefined',
  isOpera = typeof chrome !== 'undefined' && navigator.userAgent.indexOf("OPR") !== -1,
  isChrome = typeof chrome !== 'undefined' && navigator.userAgent.indexOf("OPR") === -1;

/**** wrapper (start) ****/
if (isChrome || isOpera) {
  background.send = function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  }
  background.receive = function (id, callback) {
    if (id === "show") {
      window.addEventListener("load", function () {
        background.send("show");
        callback();
      }, false);
    }
    else {
      chrome.extension.onRequest.addListener(function(request, sender, c) {
        if (request.method == id) {
          callback(request.data);
        }
      });
    }
  }
  manifest.url = chrome.extension.getURL('');
}
if (isSafari) {
  background = (function () {
    var callbacks = {};
    return {
      send: function (id, data) {
        safari.extension.globalPage.contentWindow.app.popup.dispatchMessage(id, data);
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
  manifest.url = safari.extension.baseURI;
}
if (isFirefox) {
  background.send = self.port.emit;
  background.receive = self.port.on;
  manifest.url = self.options.base;
  background.receive("show", function () {
    background.send("show");
  });
}
/**** wrapper (end) ****/
var objs, contentCache = [], selected = {};

var qs = function (q, m) {
  var reserved = {
    'stats': 'header div[name="stat"] b',
    'accounts': '#accounts',
    'content': '#content',
    'expand': '#expand',
    'date': '#content div[name="date"]',
    'email': '#content div[name="email"]',
    'sender': '#content div[name="sender"] a',
    'title': '#content div[name="title"] a',
    'next': 'header div div:nth-child(2)',
    'previous': 'header div div:nth-child(1)',
    'archive': 'footer div[name="archive"]',
    'spam': 'footer div[name="spam"]',
    'settings': 'footer div[name="settings"]',
    'gmail': 'footer div[name="gmail"]',
    'trash': 'footer div[name="trash"]',
    'refresh': 'footer div[name="refresh"]',
    'read': 'footer div[name="read"]',
    'read-all': 'footer div[name="read-all"]',
    'email-container': 'header div[name="email-container"]',
    'iframe': '#content iframe',
  }
  q = reserved[q] || q;
  qs.cache = qs.cache || [];
  qs.cache[q] = qs.cache[q] || document[m ? "querySelectorAll" : "querySelector"](q);
  return qs.cache[q];
}

var html = (function() {
  // List of all used elements
  var li = document.createElement("li");

  function addContent(elem, txt) {
    if (txt) {
      elem.textContent = txt;
    }
    return elem;
  }
  return function(tag, txt) {
    var tmp;
    switch (tag) {
    case "li":
      tmp = li.cloneNode(false);
      break;
    default:
      tmp = document.createElement(tag);
    }
    return addContent(tmp, txt);
  }
})();
/** objects **/
var accountSelector = (function() {
  var tmp = qs('email-container');
  return {
    get text() {
      return tmp.textContent;
    },
    set text(val) {
      tmp.textContent = val;
    }
  }
})();
var stat = (function() {
  var list = qs('stats', true);
  return {
    get current() {
      return list[0].textContent;
    },
    set current(val) {
      list[0].textContent = val;
    },
    get total() {
      return list[1].textContent;
    },
    set total(val) {
      list[1].textContent = val;
    }
  }
})();
var body = (function() {
  var date = qs('date'),
      email = qs('email'),
      name = qs('sender'),
      title = qs('title');
  return {
    get date() {
      return date.textContent
    },
    set date(val) {
      date.textContent = val;
    },
    get email() {
      return email.textContent
    },
    set email(val) {
      email.textContent = val;
    },
    get name() {
      return name.textContent
    },
    set name(val) {
      name.textContent = val;
    },
    set nameLink(val) {
      name.setAttribute("href", val)
    }, get title() {
      return title.textContent;
    },
    set title(val) {
      title.textContent = val  || "(no subject)";
    },
    set titleLink(val) {
      title.setAttribute("href", val)
    }
  }
})();

/** Listeners **/
var Listen = function(query, on, callback, pointer) {
  var elem = qs(query);
  elem.addEventListener(on, function(e) {
    if (elem.getAttribute("disabled") == "true") {
      return;
    }
    if (callback) callback.apply(pointer, [e]);
  }, false);
}

new Listen('email-container', "click", function(e) {
  // Clear old list
  qs("accounts").innerHTML = "";
  // Add new items (remove no-unread accounts first)
  objs.
    filter(function (o) {
      return o.xml.fullcount;
    })
    .map(function (o) {
      return [o.xml.title + (o.xml.label ? " [" + o.xml.label + "]" : ""), o.xml.link];
    })
    .forEach(function (arr) {
      var li = html("li", arr[0]);

      li.setAttribute("value", arr[1]);
      li.setAttribute("class", "ellipsis");
      if (selected.entry && arr[1] == selected.parent.xml.link) {
        li.classList.add("selected");
      }
      qs("accounts").appendChild(li);
    });
  // Show menu
  qs("accounts").style.display = "block";
  e.stopPropagation();

  function tmp(e) {
    qs("accounts").style.display = "none";
    window.removeEventListener("click", tmp);
  }
  window.addEventListener("click", tmp, false);
});
new Listen("accounts", "click", function(e) {
  var target = e.originalTarget || e.target;
  var link = target.getAttribute("value");
  if (selected.parent.xml.link != link) {
    var obj = objs.reduce(function (p, c) {
      return c.xml.link == link ? c : p
    });
    selected.entry = obj.xml.entries[0];
    selected.parent = obj;
    update();
  }
});
new Listen("next", "click", function(e) {
  update(false, true);
});
new Listen("previous", "click", function(e) {
  update(true, false);
});
/** Update UI if necessary **/
var update = (function () {
  var old = {link: null, id: null, count: null};
  var index;
  return function (previous, next) {
    // Make sure the selected entry is still available
    var isAvailable = objs.reduce(function (p, c) {
      return p.concat(c.xml.entries)
    }, []).reduce(function (p, c) {
      return p || selected.entry && c.id == selected.entry.id;
    }, false);
    if (!isAvailable) {
      // does the old account still have unread entries?
      var obj = objs.filter(function (o) {
        return o.xml.link == selected.parent.xml.link;
      });
      if (obj.length && obj[0].xml.fullcount) {
        selected.entry = obj[0].xml.entries[Math.min(obj[0].xml.entries.length - 1, index)];
        selected.parent = obj[0];
      }
      else {
        selected.parent = objs.reduce(function (p, c) {
          return c.xml.fullcount ? c : p;
        });
        selected.entry = selected.parent.xml.entries[0];
      }
    }
    else { // Even if the selected entry is available still the parent might have been changed
      selected.parent = objs.filter(function (o) {
        return o.xml.link == selected.parent.xml.link
      })[0];
    }
    // updating current index
    selected.parent.xml.entries.forEach(function (entry, i) {
      if (entry.id == selected.entry.id) {
        if (index != i) {
          index = i;
          // Although body is updated but index is not
          stat.current = index + 1;
        }
      }
    });

    // Is previous or next requested
    if (previous && index > 0) {
      index -= 1;
      selected.entry = selected.parent.xml.entries[index];
    }
    if (next && selected.parent.xml.entries.length - 1 > index) {
      index += 1;
      selected.entry = selected.parent.xml.entries[index];
    }

    // What parts need update
    var doAccountSelector = old.link != selected.parent.xml.link,
        doAccountBody = old.id != selected.entry.id,
        doNumber = old.count != selected.parent.xml.fullcount,
        doPrevious = index !== 0;
        doNext = index != selected.parent.xml.entries.length - 1;

    if (doAccountSelector) {
      old.link = selected.parent.xml.link;
      accountSelector.text = selected.parent.xml.title + (selected.parent.xml.label ? " [" + selected.parent.xml.label + "]" : "");
    }
    if (doAccountBody) {
      old.id = selected.entry.id;

      var base = /[^\?]*/.exec(selected.entry.link)[0];
      var message_id = /message_id\=([^\&]*)/.exec(selected.entry.link);
      stat.current = index + 1;
      body.title = selected.entry.title;
      body.titleLink = (message_id.length == 2 && message_id[1]) ? base + "/?shva=1#inbox/" + message_id[1] : selected.entry.link;
      body.name = selected.entry.author_name;
      //body.nameLink = base + "?view=cm&fs=1&tf=1&to=" + selected.entry.author_email;
      body.nameLink = "mailto:" + selected.entry.author_email + "?subject=Re: " + selected.entry.title;
      body.email = "<" + selected.entry.author_email + ">";
      updateContent ();
    }
    if (doNumber) {
      old.count = selected.parent.xml.fullcount;
      stat.total = selected.parent.xml.fullcount;
    }
    if (doPrevious) {
      qs("previous").removeAttribute("disabled");
    }
    else {
      qs("previous").setAttribute("disabled", true);
    }
    if (doNext) {
      qs("next").removeAttribute("disabled");
    }
    else {
      qs("next").setAttribute("disabled", true);
    }
    body.date = prettyDate(selected.entry.modified);
  }
})();

new Listen('archive', "click", function(e) {
  qs('archive').setAttribute("wait", true);
  qs('archive').setAttribute("disabled", true);
  background.send("action", {
    links: selected.entry.link,
    cmd: "rc_%5Ei"
  });
});
new Listen('trash', "click", function(e) {
  qs('trash').setAttribute("wait", true);
  qs('trash').setAttribute("disabled", true);
  background.send("action", {
    links: selected.entry.link,
    cmd: "tr"
  });
});
new Listen('spam', "click", function(e) {
  qs('spam').setAttribute("wait", true);
  qs('spam').setAttribute("disabled", true);
  background.send("action", {
    links: selected.entry.link,
    cmd: "sp"
  });
});
new Listen('read', "click", function(e) {
  qs('read').textContent = "Wait...";
  qs('read').setAttribute("disabled", true);
  background.send("action", {
    links: selected.entry.link,
    cmd: "rd"
  });
});
new Listen('refresh', "click", function(e) {
  background.send("update");
});
new Listen('gmail', "click", function(e) {
  background.send("open", selected.parent.xml.link);
});
new Listen('settings', "click", function(e) {
  background.send("options");
});
new Listen('read-all', "click", function(e) {
  qs('read-all').setAttribute("wait", true);
  qs('read-all').setAttribute("disabled", true);
  var links = selected.parent.xml.entries.map(function (e) {
    return e.link;
  });
  background.send("action", {
    links: links,
    cmd: "rd-all"
  });
});

background.receive("action-response", function(cmd) {
  if (cmd == "rd") {
    qs('read').textContent = "Mark as read";
    qs('read').removeAttribute("disabled");
  }
  else {
    var obj;
    switch (cmd) {
    case "rd":
      obj = qs('read');
      break;
    case "rd-all":
      obj = qs('read-all');
      break;
    case "tr":
      obj = qs('trash');
      break;
    case "rc_%5Ei":
      obj = qs('archive');
      break;
    case "sp":
      obj = qs('spam');
      break;
    }
    obj.removeAttribute("wait");
    obj.removeAttribute("disabled");
  }
});
new Listen("expand", "click", function () {
  var mode = qs("body").getAttribute("mode") === "expanded" ? 0 : 1;
  background.send("mode", mode);
});
function updateContent () {
  function doSummary () {
    if (!selected.entry) return;
    var summary = selected.entry.summary;
    qs("iframe").contentDocument.body.textContent = summary + " ...";
  }

  var type = qs("body").getAttribute("mode") === "expanded";
  if (type) {
    var link = selected.entry.link;
    var content = contentCache[link];
    if (content) {
      qs("content").removeAttribute("loading");
      //content is a safe HTML parsed by (plain-text.js)
      qs("iframe").contentDocument.body.innerHTML = content;
    }
    else {
      doSummary ();
      qs("content").setAttribute("loading", "true");
      background.send("body", link);
    }
  }
  else {
    doSummary();
  }
}
background.receive("body-response", function(o) {
  if (o.link == selected.entry.link) {
    // For chat conversations, there is no full content mode
    contentCache[o.link] = o.content === "..." ?  selected.entry.summary + " ..." : o.content;
    updateContent ();
  }
});
// iframe manipulations
(function () {
  var doc = qs("iframe").contentDocument;
  var head = doc.getElementsByTagName('head')[0];
  var link = doc.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  link.setAttribute("href", manifest.url + "data/popup/body/email.css");
  head.appendChild(link);
})();
// Link opener for html
function opener (e) {
  e.preventDefault();
  var target = e.originalTarget || e.target;
  var selectedText = target.ownerDocument.getSelection() + '';

  var link = target.href || target.src;

  if (target.localName != "a" && target.parentNode && target.parentNode.localName == "a") {
    link = target.parentNode.href || link;
  }

  if (link) {
    if (e.button === 2) {
      background.send("clipboard", {
        str: link,
        type: 0
      });
    }
    else {
      background.send("open", link);
    }
  }
  else if (e.button === 2 && selectedText) {
    background.send("clipboard", {
      str: selectedText,
      type: 1
    });
  }
}
window.addEventListener("click", opener);
qs("iframe").contentDocument.addEventListener("click", opener);
function keyup (e) {
  if (!keyup.doKeyUp) return;

  if (e.keyCode == 49 && e.shiftKey) qs("spam").click();
  if (e.keyCode == 51 && e.shiftKey) qs("trash").click();
  if (e.keyCode == 73 && e.shiftKey) qs("read").click();
  if (e.keyCode == 69) qs("archive").click();
}
background.receive("keyUp", function (b) {
  keyup.doKeyUp = b;
});
window.addEventListener("keyup", keyup);
qs("iframe").contentDocument.addEventListener("keyup", keyup);
// Communications
background.receive("show", function () {
  ["archive", "spam", "trash", "read", "read-all"].map(qs).forEach(function (obj) {
    obj.removeAttribute("wait");
    obj.removeAttribute("disabled");
  });
  qs('read').textContent = "Mark as read";

  background.send("resize");
  background.send("keyUp");
  window.focus(); // Make sure window has focus when it is shown
});
background.receive("resize", function (o) {
  if (o.mode === 1) {
    document.body.setAttribute("mode", "expanded");
  }
  else {
    document.body.removeAttribute("mode");
    qs("content").removeAttribute("loading");
  }
  if (isChrome || isOpera) {
    document.body.style.width = o.width + "px";
    document.body.style.height = (o.height - 20) + "px";
    document.querySelector("html").style.height = (o.height - 20) + "px";
  }
  if (selected.entry) {
    updateContent();
  }
  //Close account selection menu if it is open
  qs("accounts").style.display = "none";
});
background.receive("update-date", function () {
  //This function is called on every server response.
  if (!selected.entry) return;
  body.date = prettyDate(selected.entry.modified);
});
background.receive("update-reset", function (o) {
  //Update
  objs = o;
  //Selected account
  var unreadEntries =
    objs.map(function (obj) {
      return obj.xml.entries.filter(function (e) {
        return obj.newIDs.indexOf(e.id) != -1;
      });
    }).
    reduce(function (p, c) {
      return p.concat(c);
    }, []);
  if (unreadEntries.length) {
    var newestEntry = unreadEntries.sort(function (p, c) {
      var d1 = new Date(p.modified);
      var d2 = new Date(c.modified);
      return d1 < d2;
    })[0];
    selected.entry = newestEntry;
    selected.parent = objs.reduce(function (p, c) {
      return c.xml.entries.indexOf(newestEntry) != -1 ? c : p;
    });
  }
  else if (selected.entry) {  }
  else {
    selected = {
      entry: objs[0].xml.entries[0],
      parent: objs[0]
    };
  }
  update();
});
background.receive("update", function (o) {
  objs = o;
  update();
});

function prettyDate(time) {
  var date = new Date((time || "")),
      diff = (((new Date()).getTime() - date.getTime()) / 1000),
      day_diff = Math.floor(diff / 86400);

  if (isNaN(day_diff) || day_diff < 0) {
    return "just now";
  }
  return day_diff == 0 && (
    diff < 60 && "just now" ||
    diff < 120 && "1 minute ago" ||
    diff < 3600 && Math.floor(diff / 60) + " minutes ago" ||
    diff < 7200 && "1 hour ago" ||
    diff < 86400 && Math.floor(diff / 3600) + " hours ago") ||
    day_diff == 1 && "Yesterday" ||
    day_diff < 7 && day_diff + " days ago" ||
    day_diff < 7 * 7 && Math.ceil(day_diff / 7) + " weeks ago" ||
    day_diff < 7 * 4 * 3 && Math.ceil(day_diff / 7 / 4) + " months ago" ||
    [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ][date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear().toString();
}
