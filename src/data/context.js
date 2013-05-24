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
var unreadObjs;
var selectedAccount, doNext = false,
    doPrevious = false;
self.port.on("command", function(uo) {
  //Close account selection menu if it is open
  $("accounts").style.display = "none";
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
}); /** objects **/
var accountSelector = (function() {
  var tmp = $("account_selector").getElementsByTagName("span")[0];
  return {
    get text() {
      return tmp.textContent;
    }, set text(val) {
      tmp.textContent = val;
    }
  }
})();
var stat = (function() {
  var list = $("stat").getElementsByTagName("b");
  return {
    get current() {
      return list[0].textContent;
    }, set current(val) {
      list[0].textContent = val;
    }, get total() {
      return list[1].textContent;
    }, set total(val) {
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
    }, set content(val) {
      content.textContent = val;
    }, get date() {
      return date.textContent
    }, set date(val) {
      date.textContent = val;
    }, get email() {
      return email.textContent
    }, set email(val) {
      email.textContent = val;
    }, get name() {
      return name.textContent
    }, set name(val) {
      name.textContent = val;
    }, set nameLink(val) {
      name.setAttribute("href", val)
    }, get title() {
      return title.textContent
    }, set title(val) {
      title.textContent = val;
    }, set titleLink(val) {
      title.setAttribute("href", val)
    }
  }
})(); /** Listeners **/
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
    if (selectedAccount && obj.account == selectedAccount) li.classList.add("selected");
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
}); /** **/
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
      stat.current = index + 1;
      body.title = entry.title;
      body.titleLink = entry.link;
      body.name = entry.author_name;
      body.nameLink = /[^\?]*/.exec(entry.link)[0] + "?view=cm&fs=1&tf=1&to=" + entry.author_email;
      var email = entry.author_email;
      if (email.length > 18) {
        var tmp = email.split("@");
        email = tmp[0].substr(0, 15) + "...@" + tmp[1];
      }
      body.email = "<" + email + ">";
      body.date = prettyDate(entry.modified);
      body.content = entry.summary + "...";
      _tag[selectedAccount] = entry.id;
      //Support for the RTL
      var dir = window.getComputedStyle($("email_title"), null).direction;
      if (dir == "rtl") $("content").classList.add("rtl");
      else
      $("content").classList.remove("rtl");
    }
    var doBody = !_tag[selectedAccount] || doAccountSelector || doNext || doPrevious;
    // Make sure selected item is still avaialable
    if (!doBody) {
      var isAvailable = false;
      obj.entries.forEach(function(entry) {
        if (entry.id == _tag[selectedAccount]) {
          isAvailable = true;
        }
      });
      if (!isAvailable) {
        doBody = true;
        if (jIndex) {
          _tag[selectedAccount] = obj.entries[jIndex - 1].id;
        } else {
          _tag[selectedAccount] = null;
        }
      }
    }
    if (doBody) {
      if (!_tag[selectedAccount]) {
        _tag[selectedAccount] = obj.entries[0].id;
      }
      for (var j = obj.entries.length - 1; j >= 0; j -= 1) {
        var entry = obj.entries[j];
        if (entry.id == _tag[selectedAccount]) {
          if (doNext) {
            doNext = false;
            jIndex = j + 1;
            updateBody(obj.entries[jIndex], jIndex);
          } else if (doPrevious) {
            doPrevious = false;
            jIndex = j - 1;
            updateBody(obj.entries[jIndex], jIndex);
          } else {
            jIndex = j;
            updateBody(entry, jIndex);
          }
          break;
        }
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
    } else {
      $("previous").removeAttribute("disabled");
    }
    if (nt) {
      $("next").setAttribute("disabled", true);
    } else {
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
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "rd");
});
new Listen("refresh", "click", function(e) {
  self.port.emit("update");
});
self.port.on("action-response", function(cmd) {
  if (cmd == "rd") {
    $("read").textContent = "Mark as read";
  } else {
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
}); /** misc **/
/*
* JavaScript Pretty Date
* Copyright (c) 2011 John Resig (ejohn.org)
* Licensed under the MIT and GPL licenses.
*/

function prettyDate(time) {
  var date = new Date((time || "")),
      diff = (((new Date()).getTime() - date.getTime()) / 1000),
      day_diff = Math.floor(diff / 86400);
  if (isNaN(day_diff) || day_diff < 0 || day_diff >= 31) return;
  return day_diff == 0 && (
  diff < 60 && "just now" || diff < 120 && "1 minute ago" || diff < 3600 && Math.floor(diff / 60) + " minutes ago" || diff < 7200 && "1 hour ago" || diff < 86400 && Math.floor(diff / 3600) + " hours ago") || day_diff == 1 && "Yesterday" || day_diff < 7 && day_diff + " days ago" || day_diff < 31 && Math.ceil(day_diff / 7) + " weeks ago";
}
document.defaultView.addEventListener('ignotifier-open', function(e) {
  self.port.emit("open", e.detail.link);
});