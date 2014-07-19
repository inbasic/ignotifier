var doKeyUp = false;

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

var objs, contentCache = [], selected = {};

self.port.on("update-reset", function(o) {
  //Update
  objs = o;
  //Selected account
  var unreadEntries = 
    objs.map(obj => obj.xml.entries.filter((e) => obj.newIDs.indexOf(e.id) != -1)).
    reduce((p,c) => p.concat(c), []);
  if (unreadEntries.length) {
    var newestEntry = unreadEntries.sort(function (p, c) {
      var d1 = new Date(p.modified);
      var d2 = new Date(c.modified);
      return d1 < d2;
    })[0];
    selected.entry = newestEntry;
    selected.parent = objs.reduce((p,c) => c.xml.entries.indexOf(newestEntry) != -1 ? c : p);
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
self.port.on("update", function (o) {
  objs = o;
  update();
});
self.port.on("update-date", function () {
  //This function is called on every server response.
  if (!selected.entry) return;
  body.date = prettyDate(selected.entry.modified);
});

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
    filter(o => o.xml.fullcount).
    map(o => [o.xml.title + (o.xml.label ? " [" + o.xml.label + "]" : ""), o.xml.link]).forEach(function (arr) {
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
    var obj = objs.reduce((p,c) => c.xml.link == link ? c : p);
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
    var isAvailable = objs.reduce((p,c) => p.concat(c.xml.entries), []).reduce((p,c) => p || c.id == selected.entry.id, false);
    if (!isAvailable) {
      // does the old account still have unread entries?
      var obj = objs.filter(o => o.xml.link == selected.parent.xml.link);
      if (obj.length && obj[0].xml.fullcount) {
        selected.entry = obj[0].xml.entries[Math.min(obj[0].xml.entries.length - 1, index)];
        selected.parent = obj[0];
      }
      else {
        selected.parent = objs.reduce((p,c) => c.xml.fullcount ? c : p);
        selected.entry = selected.parent.xml.entries[0];
      }
    }
    else { // Even if the selected entry is available still the parent might have been changed
      selected.parent = objs.filter(o => o.xml.link == selected.parent.xml.link)[0];
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
      body.nameLink = base + "?view=cm&fs=1&tf=1&to=" + selected.entry.author_email;
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
  self.port.emit("action", selected.entry.link, "rc_%5Ei");
});
new Listen('trash', "click", function(e) {
  qs('trash').setAttribute("wait", true);
  qs('trash').setAttribute("disabled", true);
  self.port.emit("action", selected.entry.link, "tr");
});
new Listen('spam', "click", function(e) {
  qs('spam').setAttribute("wait", true);
  qs('spam').setAttribute("disabled", true);
  self.port.emit("action", selected.entry.link, "sp");
});
new Listen('read', "click", function(e) {
  qs('read').textContent = "Wait...";
  qs('read').setAttribute("disabled", true);
  self.port.emit("action", selected.entry.link, "rd");
});
new Listen('refresh', "click", function(e) {
  self.port.emit("update");  
});
new Listen('gmail', "click", function(e) {
  self.port.emit("open", selected.parent.xml.link); 
});
new Listen('read-all', "click", function(e) {
  qs('read-all').setAttribute("wait", true);
  qs('read-all').setAttribute("disabled", true);
  var links = selected.parent.xml.entries.map(e => e.link);
  self.port.emit("action", links, "rd-all");
});
self.port.on("action-response", function(cmd) {
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
  resize(qs("body").getAttribute("mode") == "expanded" ? 0 : 1);
});
function updateContent () {
  function doSummary () {
    var summary = selected.entry.summary;
    qs("iframe").contentDocument.body.textContent = summary + " ...";
  }

  var type = qs("body").getAttribute("mode") == "expanded";
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
      self.port.emit("body", link);
    }
  }
  else {
    doSummary();
  }
}
self.port.on("body-response", function(link, content) {
  if (link == selected.entry.link) {
    // For chat conversations, there is no full content mode
    contentCache[link] = content === "..." ?  selected.entry.summary + " ..." : content;
    updateContent ();
  }
});
/** misc functions **/
// iframe manipulations
(function () {
  var doc = qs("iframe").contentDocument;
  var head = doc.getElementsByTagName('head')[0];
  var link = doc.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  link.setAttribute("href", "resource://jid0-gjwrpchs3ugt7xydvqvk4dqk8ls-at-jetpack/gmail-notifier/data/panel/body/email.css");
  head.appendChild(link);
})();
// Link opener for html
function opener (e) {
  e.preventDefault();
  var target = e.originalTarget;
  var selectedText = target.ownerDocument.getSelection() + '';
  if (target.href || target.src) {
    self.port.emit(e.button === 2 ? "clipboard" : "open", target.href || target.src, 0);
  }
  else if (e.button === 2 && selectedText) {
    self.port.emit("clipboard", selectedText, 1);
  }
}
window.addEventListener("click", opener);
qs("iframe").contentDocument.addEventListener("click", opener);
function keyup (e) {
  if (!doKeyUp) return;
  
  if (e.keyCode == 49 && e.shiftKey) qs("spam").click();
  if (e.keyCode == 51 && e.shiftKey) qs("trash").click();
  if (e.keyCode == 73 && e.shiftKey) qs("read").click();
  if (e.keyCode == 69) qs("archive").click();
}
window.addEventListener("keyup", keyup);
qs("iframe").contentDocument.addEventListener("keyup", keyup);
// Resize
function resize(mode) {
  mode = parseInt(mode);
  self.port.emit('resize', mode);
  if (mode) {
    qs("body").setAttribute("mode", "expanded");
  }
  else {
    qs("body").removeAttribute("mode");
    qs("content").removeAttribute("loading");
  }
  updateContent();
  //Close account selection menu if it is open
  qs("accounts").style.display = "none";
}
self.port.on("resize", function (mode) {
  resize(mode);
});
// Keyboard support
self.port.on("keyUp", function (b) {
  doKeyUp = b;
});
window.addEventListener("load", function () {
  self.port.emit("keyUp");
});
// Make sure window has focus when it is shown
self.port.on("show", function onShow() {
  window.focus();
});
// JavaScript Pretty Date by John Resig (ejohn.org)
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
    [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ][date.getMonth()] + " " + date.getFullYear().toString().substring(2);
}