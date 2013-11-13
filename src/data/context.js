var $ = (function() {
  var cache = [];
  return function(id) {
    if (cache[id]) {
      return cache[id];
    }
    cache[id] = document.getElementById(id);
    return cache[id];
  }
})();
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

var unreadObjs, contentCache = [];
var selectedAccount, doNext = false,
    doPrevious = false;
self.port.on("command", function(uo) {
  //Update
  unreadObjs = uo;
  //Is previouly selected account still available?
  if (selectedAccount) {
    var isAvailable = false;
    unreadObjs.forEach(function(obj) {
      if (obj.account == selectedAccount) {
        isAvailable = true;
      }
    });
    if (!isAvailable) {
      selectedAccount = unreadObjs[0].account;
    }
  }
  update();
});
/** objects **/
var accountSelector = (function() {
  var tmp = $("account_selector").getElementsByTagName("span")[0];
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
  var list = $("stat").getElementsByTagName("b");
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
  var content = $("email_body"),
      date = $("date"),
      email = $("email"),
      name = $("name"),
      title = $("title");
  return {
    get content() {
      return content.textContent
    },
    set content(val) {
      content.textContent = val;
    },
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
var Listen = function(id, on, callback, pointer) {
  var elem = $(id);
  elem.addEventListener(on, function(e) {
    if (elem.getAttribute("disabled") == "true") {
      return;
    }
    if (callback) callback.apply(pointer, [e]);
  }, false);
}
new Listen("account_selector", "click", function(e) {
  // Clear old list
  while ($("accounts").firstChild) {
    $("accounts").removeChild($("accounts").firstChild);
  }
  // Add new items
  unreadObjs.forEach(function(obj) {
    var li = html("li", obj.account);
    if (selectedAccount && obj.account == selectedAccount) {
      li.classList.add("selected");
    }
    $("accounts").appendChild(li);
  });
  e.stopPropagation();
  // Show menu
  $("accounts").style.display = "block";
  e.stopPropagation();

  function tmp(e) {
    $("accounts").style.display = "none";
    window.removeEventListener("click", tmp);
  }
  window.addEventListener("click", tmp, false);
});
new Listen("accounts", "click", function(e) {
  selectedAccount = e.originalTarget.textContent;
  //unselect the selected
  var li = $("accounts").firstChild;
  while (li) {
    li.classList.remove("selected");
    li = li.nextElementSibling;
  }
  e.originalTarget.classList.add("selected");
  update();
});
new Listen("next", "click", function(e) {
  doNext = true;
  update();
});
new Listen("previous", "click", function(e) {
  doPrevious = true;
  update();
});
/** Update UI if necessary **/
var iIndex, jIndex;
var update = (function() {
  var _selectedAccount, _tag = [];
  return function() {
    // Is update required?
    for (var i = unreadObjs.length - 1; i >= 0; i -= 1) {
      iIndex = i;
      var obj = unreadObjs[i];
      if (obj.account == selectedAccount && obj.count) {
        break;
      }
    }
    var obj = unreadObjs[iIndex];
    // Update accoutSelector
    var doAccountSelector = !_selectedAccount || _selectedAccount != selectedAccount;
    if (doAccountSelector) {
      if (!selectedAccount) {
        selectedAccount = obj.account;
      }
      _selectedAccount = selectedAccount;
      accountSelector.text = selectedAccount;
    }
    // Update email's body
    function updateBody(entry, index) {
      var base = /[^\?]*/.exec(entry.link)[0];
      var id = /message_id\=([^\&]*)/.exec(entry.link);
      
      stat.current = index + 1;
      body.title = entry.title;
      body.titleLink = (id.length == 2 && id[1]) ? base + "/?shva=1#inbox/" + id[1] : entry.link;
      body.name = entry.author_name;
      body.nameLink = base + "?view=cm&fs=1&tf=1&to=" + entry.author_email;
      body.email = "<" + entry.author_email + ">";
      body.date = prettyDate(entry.modified);
      updateContent ();
      _tag[selectedAccount] = entry.id;
    }
    var doBody = !_tag[selectedAccount] || doAccountSelector || doNext || doPrevious;
    // Make sure selected item is still available
    if (!doBody) {
      var isAvailable = false;
      obj.entries.forEach(function(entry, index) {
        if (entry.id == _tag[selectedAccount]) {
          isAvailable = true;
          // Tag is available but its index is wrong due to recent update,
          // So switch to the first index (newest one)
          if (index != parseInt(stat.current) - 1) {
            _tag[selectedAccount] = null;
            doBody = true;
          }
          // Old entry, just update time
          else {
            body.date = prettyDate(entry.modified);
          }
        }
      });
      if (!isAvailable) {
        doBody = true;
        if (jIndex && obj.entries[jIndex - 1]) {
          _tag[selectedAccount] = obj.entries[jIndex - 1].id;
        } 
        else {
          _tag[selectedAccount] = null;
        }
      }
    }
    if (doBody) {
      if (!_tag[selectedAccount]) {
        _tag[selectedAccount] = obj.entries[0].id;
      }
      var detected = false;
      for (var j = obj.entries.length - 1; j >= 0; j -= 1) {
        var entry = obj.entries[j];
        if (entry.id == _tag[selectedAccount]) {
          detected = true;
          if (doNext) {
            jIndex = j + 1;
            doNext = false;
          }
          else if (doPrevious) {
            doPrevious = false;
            jIndex = j - 1;
            updateBody(obj.entries[jIndex], jIndex);
          }
          else {
            jIndex = j;
          }
          updateBody(obj.entries[jIndex], jIndex);
          break;
        }
      }
      // In case, email thread is not detected, switch to the first email
      if (!detected) {
        jIndex = 0;
        updateBody(obj.entries[jIndex], jIndex);
      }
    }
    // Update toolbar buttons
    var pr = false,
        nt = false;
    if (jIndex == 0) {
      pr = true;
    }
    if (jIndex == obj.count - 1 || jIndex == 19) {
      nt = true;
    }
    if (obj.count == 1) {
      pr = true;
      nt = true;
    }
    if (pr) {
      $("previous").setAttribute("disabled", true);
    }
    else {
      $("previous").removeAttribute("disabled");
    }
    if (nt) {
      $("next").setAttribute("disabled", true);
    }
    else {
      $("next").removeAttribute("disabled");
    }
    // Update stat
    stat.total = obj.count;
  }
})();
new Listen("archive", "click", function(e) {
  $("archive").setAttribute("wait", true);
  $("archive").setAttribute("disabled", true);
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "rc_%5Ei");
});
new Listen("trash", "click", function(e) {
  $("trash").setAttribute("wait", true);
  $("trash").setAttribute("disabled", true);
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "tr");
});
new Listen("spam", "click", function(e) {
  $("spam").setAttribute("wait", true);
  $("spam").setAttribute("disabled", true);
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "sp");
});
new Listen("read", "click", function(e) {
  $("read").textContent = "Wait...";
  $("read").setAttribute("disabled", true);
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "rd");
});
new Listen("refresh", "click", function(e) {
  self.port.emit("update");  
});
new Listen("inbox", "click", function(e) {
  self.port.emit("open", unreadObjs[iIndex].link); 
});
self.port.on("action-response", function(cmd) {
  if (cmd == "rd") {
    $("read").textContent = "Mark as read";
    $("read").removeAttribute("disabled");
  }
  else {
    var obj;
    switch (cmd) {
    case "rd":
      obj = $("read");
      break;
    case "tr":
      obj = $("trash");
      break;
    case "rc_%5Ei":
      obj = $("archive");
      break;
    case "sp":
      obj = $("spam");
      break;
    }
    obj.removeAttribute("wait");
    obj.removeAttribute("disabled");
  }
  self.port.emit("decrease_mails", iIndex, jIndex);
});
new Listen("expand", "click", function () {
  var type = $("content").getAttribute("type");
  resize(type ? 0 : 1);
});
function updateContent () {
  function doSummary () {
    var summary = unreadObjs[iIndex].entries[jIndex].summary;
    $("email_body").textContent = summary + " ...";
  }

  var type = $("content").getAttribute("type");
  if (type) {
    if (typeof iIndex === 'undefined' || typeof jIndex === 'undefined') return;
    var link = unreadObjs[iIndex].entries[jIndex].link;
    var content = contentCache[link];
    if (content) {
      $("content").removeAttribute("mode");
      $("email_body").textContent = content;
    }
    else {
      doSummary ();
      $("content").setAttribute("mode", "loading");
      self.port.emit("body", link);
    }
  }
  else {
    doSummary();
  }

}
self.port.on("body-response", function(link, content) {
  if (link == unreadObjs[iIndex].entries[jIndex].link) {
    contentCache[link] = content;
    updateContent ();
  }
});
/** misc functions **/
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
    day_diff && Math.ceil(day_diff / 7) + " weeks ago";
}
// Link opener for html
document.defaultView.addEventListener('ignotifier-open', function(e) {
  self.port.emit("open", e.detail.link);
});

// Resize
function resize(mode) {
  mode = parseInt(mode);
  width = mode ? 530 : 430;
  height = mode ? 500 : 209;
  document.body.clientWidth = width + "px";
  $("email_body").style.height = (height - 180) + "px";
  self.port.emit('resize', {
    width: width,
    height: height,
    mode: mode
  });
  if (mode) {
    $("content").setAttribute("type", "expanded");
    $("header").setAttribute("type", "expanded");
  }
  else {
    $("content").removeAttribute("type");
    $("header").removeAttribute("type");
  }
  updateContent();
  //Close account selection menu if it is open
  $("accounts").style.display = "none";
}
self.port.on("resize", function (mode) {
  resize(mode);
});