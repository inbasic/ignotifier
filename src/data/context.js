var $ = (function () {
  var cache = [];
  return function (id) {
    if (cache[id]) {
      return cache[id];
    }
    cache[id] = document.getElementById(id);
    return cache[id];
  }
})();
var html = (function () {
  var li = document.createElement("li");
  function addContent (elem, txt) {
    if (txt) {
      elem.textContent = txt;
    }
    return elem;
  }
  
  return function (tag, txt) {
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
var selectedAccount, doNext = false, doPrevious = false;

self.port.on("command", function (uo) {
  //Close account selection menu if it is open
  $("accounts").style.display = "none";
  //Update
  unreadObjs = uo;
  //Is previouly selected account still available?
  if (selectedAccount) {
    var isAvailable = false;
    unreadObjs.forEach(function (obj) {
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
var accountSelector = (function () {
  var tmp = $("account-selector").getElementsByTagName("span")[0];
  return {
    get text () {
      return tmp.textContent;
    },
    set text(val) {
      tmp.textContent = val;
    }
  }
})();
var stat = (function () {
  var list = $("stat").getElementsByTagName("b");
  return {
    get current () {
      return list[0].textContent;
    },
    set current (val) {
      list[0].textContent = val;
    },
    get total () {
      return list[1].textContent;
    },
    set total (val) {
      list[1].textContent = val;
    }
  }
})();
var body = (function () {
  var content = $("content"), 
    date = $("date"), 
    email = $("email"),
    name = $("name"), 
    title = $("title");
  
  return {
    get content () {
      return content.textContent
    },
    set content (val) {
      content.textContent = val;
    },
    get date () {
      return date.textContent
    },
    set date (val) {
      date.textContent = val;
    },
    get email () {
      return email.textContent
    },
    set email (val) {
      email.textContent = val;
    },
    get name () {
      return name.textContent
    },
    set name (val) {
      name.textContent = val;
    },
    set nameLink (val) {
      name.setAttribute("href", val)
    },
    get title () {
      return title.textContent
    },
    set title (val) {
      title.textContent = val;
    },
    set titleLink (val) {
      title.setAttribute("href", val)
    }
  }
})();

/** Listeners **/
var Listen = function (id, on, callback, pointer) {
  var elem = $(id);
  elem.addEventListener(on, function (e) {
    if (elem.getAttribute("disabled") == "true") {
      return;
    }
    if (callback) callback.apply(pointer, [e]);
  }, false);
}
new Listen("account-selector", "click", function (e) {
  // Clear old list
  while ($("accounts").firstChild) {
    $("accounts").removeChild($("accounts").firstChild);
  }
  // Add new items
  unreadObjs.forEach(function (obj) {
    var li = html("li", obj.account);
    $("accounts").appendChild(li);
  });
  // Show menu
  $("accounts").style.display = "block";
  e.stopPropagation();
  function tmp (e) {
    $("accounts").style.display = "none";
    window.removeEventListener("click", tmp);
  }
  window.addEventListener("click", tmp, false);
});
new Listen("accounts", "click", function (e) {
  selectedAccount = e.originalTarget.textContent;
  update();
});
new Listen("next", "click", function (e) {
  doNext = true;
  update();
});
new Listen("previous", "click", function (e) {
  doPrevious = true;
  update();
});
/** **/
var iIndex, jIndex;
var update = (function () {
  var _selectedAccount, _tag = [];
  return function () {
    // Is update required?
    for (var i = unreadObjs.length - 1; i >= 0 ; i -= 1) {
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
    function updateBody (entry, index) {
      stat.current = index + 1;
      body.title = entry.title;
      body.titleLink = entry.link;
      body.name = entry.author_name;
      body.nameLink = /[^\?]*/.exec(entry.link)[0] + "?view=cm&fs=1&tf=1&to=" + entry.author_email;
      body.email = "<" + entry.author_email + ">";
      body.date = prettyDate(entry.modified);
      body.content = entry.summary + "...";
      _tag[selectedAccount] = entry.id;
    }
    var doBody = !_tag[selectedAccount] || doAccountSelector || doNext || doPrevious;
    // Make sure selected item is still avaialable
    if (!doBody) {
      var isAvailable = false;
      obj.entries.forEach(function (entry) {
        if (entry.id == _tag[selectedAccount]) {
          isAvailable = true;
        }
      });
      if (!isAvailable) {
        doBody = true;
        if (jIndex) {
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
      for (var j = obj.entries.length - 1; j >= 0; j -= 1) {
        var entry = obj.entries[j];
        if (entry.id == _tag[selectedAccount]) {
          if (doNext) {
            doNext = false;
            jIndex = j + 1;
            updateBody(obj.entries[jIndex], jIndex);
          }
          else if (doPrevious) {
            doPrevious = false;
            jIndex = j - 1;
            updateBody(obj.entries[jIndex], jIndex);
          }
          else {
            jIndex = j;
            updateBody(entry, jIndex);
          }
          break;
        }
      }
    }
    // Update toolbar buttons
    var pr = false, nt = false;
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
new Listen("archive", "click", function (e) {
  $("archive").setAttribute("wait", true);
  $("archive").setAttribute("disabled", true);
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "rc_%5Ei");
});
new Listen("trash", "click", function (e) {
  $("trash").setAttribute("wait", true);
  $("trash").setAttribute("disabled", true);
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "tr");
});
new Listen("spam", "click", function (e) {
  $("spam").setAttribute("wait", true);
  $("spam").setAttribute("disabled", true);
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "sp");
});
new Listen("read", "click", function (e) {
  $("read").textContent = "Wait...";
  var link = unreadObjs[iIndex].entries[jIndex].link;
  self.port.emit("action", link, "rd");
});
new Listen("refresh", "click", function (e) {
  self.port.emit("update");
});
self.port.on("action-response", function (cmd) {
  if (cmd == "rd") {
    $("read").textContent = "Mark as read";
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


/** misc **/
function prettyDate(date_str) {
  var time_formats = [
    [60, 'just now', 1], // 60
    [120, '1 minute ago', '1 minute from now'], // 60*2
    [3600, 'minutes', 60], // 60*60, 60
    [7200, '1 hour ago', '1 hour from now'], // 60*60*2
    [86400, 'hours', 3600], // 60*60*24, 60*60
    [172800, 'yesterday', 'tomorrow'], // 60*60*24*2
    [604800, 'days', 86400], // 60*60*24*7, 60*60*24
    [1209600, 'last week', 'next week'], // 60*60*24*7*4*2
    [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
    [4838400, 'last month', 'next month'], // 60*60*24*7*4*2
    [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
    [58060800, 'last year', 'next year'], // 60*60*24*7*4*12*2
    [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
    [5806080000, 'last century', 'next century'], // 60*60*24*7*4*12*100*2
    [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
  ];
  var time = ('' + date_str).replace(/-/g,"/").replace(/[TZ]/g," ").replace(/^\s\s*/, '').replace(/\s\s*$/, '');
  if(time.substr(time.length-4,1)==".") time =time.substr(0,time.length-4);
  var seconds = (new Date - new Date(time)) / 1000;
  var token = 'ago', list_choice = 1;
  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    list_choice = 2;
  }
  var i = 0, format;
  while (format = time_formats[i++]) 
    if (seconds < format[0]) {
      if (typeof format[2] == 'string')
        return format[list_choice];
      else
        return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
    }
  return time;
};
document.defaultView.addEventListener('ignotifier-open', function(e) {
  self.port.emit("open", e.detail.link);
});