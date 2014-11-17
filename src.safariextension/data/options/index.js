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
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.method == id) {
        callback(request.data);
      }
    });
  }
  manifest.base = chrome.extension.getURL('');
}
if (isSafari) {
  background.send = function (id, obj) {
    safari.self.tab.dispatchMessage("message", {
      id: id,
      data: obj
    });
  }
  background.receive = (function () {
    var callbacks = {};
    safari.self.addEventListener("message", function (e) {
      if (callbacks[e.name]) {
        callbacks[e.name](e.message);
      }
    }, false);

    return function (id, callback) {
      callbacks[id] = callback;
    }
  })();
  manifest.url = safari.extension.baseURI;
}
if (isFirefox) {
  background.send = self.port.emit;
  background.receive = self.port.on;
  manifest.base = self.options.base;
  background.receive("show", function () {
    background.send("show");
  });
}
/**** wrapper (end) ****/

var connect = function (elem, pref) {
  var att = "value";
  if (elem) {
    if (elem.type == "checkbox") {
      att = "checked";
    }
    if (elem.localName == "select") {
      att = "selectedIndex";
    }
    if (elem.localName == "span") {
      att = "textContent";
    }
    var pref = elem.getAttribute("data-pref");
    background.send("get", pref);
    elem.addEventListener("change", function () {
      if (pref === "notification.sound.custom.file") {
        var file = this.files[0];
        background.send("changed", {
          pref: "notification.sound.custom.file",
          value: this.value
        });
        background.send("changed", {
          pref: "notification.sound.type",
          value: 4
        });
        background.send("changed", {
          pref: "notification.sound.custom.name",
          value: file.name
        });
        background.send("changed", {
          pref: "notification.sound.custom.mime",
          value: file.type
        });
        if (isFirefox) {
          self.port.emit("get-sound-fullpath");
        }
        else {
          var reader = new FileReader();
          reader.onload = function (e) {
            background.send("changed", {
              pref: "notification.sound.custom.file",
              value: e.target.result
            });
          }
          reader.onerror = function (e) {
            alert(e);
          }
          reader.readAsDataURL(file);
        }
        return;
      }
      background.send("changed", {
        pref: pref,
        value: this[att]
      });
    });
  }
  return {
    get value () {
      return elem[att];
    },
    set value (val) {
      if (elem.type === "file") return;
      elem[att] = val;
    }
  }
}

background.receive("set", function (o) {
  if (window[o.pref]) {
    window[o.pref].value = o.value;
  }
});

window.addEventListener("load", function () {
  var prefs = document.querySelectorAll("*[data-pref]");
  [].forEach.call(prefs, function (elem) {
    var pref = elem.getAttribute("data-pref");
    window[pref] = connect(elem, pref);
  });
}, false);
