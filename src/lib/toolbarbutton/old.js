const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var prefs    = require("sdk/simple-prefs").prefs,
    winUtils = require("sdk/deprecated/window-utils"),
    utils    = require('sdk/window/utils');

const browserURL = "chrome://browser/content/browser.xul";

/** unload+.js [start] **/
var unload = (function () {
  var unloaders = [];

  function unloadersUnlaod() {
    unloaders.slice().forEach(function(unloader) unloader());
    unloaders.length = 0;
  }

  require("sdk/system/unload").when(unloadersUnlaod);

  function removeUnloader(unloader) {
    let index = unloaders.indexOf(unloader);
    if (index != -1)
      unloaders.splice(index, 1);
  }

  return {
    unload: function unload(callback, container) {
      // Calling with no arguments runs all the unloader callbacks
      if (callback == null) {
        unloadersUnlaod();
        return null;
      }

      var remover = removeUnloader.bind(null, unloader);

      // The callback is bound to the lifetime of the container if we have one
      if (container != null) {
        // Remove the unloader when the container unloads
        container.addEventListener("unload", remover, false);

        // Wrap the callback to additionally remove the unload listener
        let origCallback = callback;
        callback = function() {
          container.removeEventListener("unload", remover, false);
          origCallback();
        }
      }

      // Wrap the callback in a function that ignores failures
      function unloader() {
        try {
          callback();
        }
        catch(ex) {}
      }
      unloaders.push(unloader);

      // Provide a way to remove the unloader
      return remover;
    }
  };
})().unload;
/** unload+.js [end] **/
/** listen.js [start] **/
var listen = function listen(window, node, event, func, capture) {
  // Default to use capture
  if (capture == null)
    capture = true;

  node.addEventListener(event, func, capture);
  function undoListen() {
    node.removeEventListener(event, func, capture);
  }

  // Undo the listener on unload and provide a way to undo everything
  let undoUnload = unload(undoListen, window);
  return function() {
    undoListen();
    undoUnload();
  };
}
/** listen.js [end] **/

exports.ToolbarButton = function ToolbarButton(options) {
  var unloaders = [],
      toolbarID = prefs.toolbarID || "",
      insertbefore = prefs.nextSibling || "",
      destroyed = false,
      destoryFuncs = [];

  var delegate = {
    onTrack: function (window) {
      if ("chrome://browser/content/browser.xul" != window.location || destroyed)
        return;

      let doc = window.document;
      let $ = function(id) doc.getElementById(id);
      options.tooltiptext = options.tooltiptext || '';
      // create toolbar button
      let tbb = doc.createElementNS(NS_XUL, "toolbarbutton");
      tbb.setAttribute("id", options.id);
      tbb.setAttribute("value", "");
      tbb.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
      tbb.setAttribute("label", options.label);
      tbb.setAttribute('tooltiptext', options.tooltiptext);
      tbb.addEventListener("command", function(e) {
        if (e.ctrlKey) return;
        if (e.originalTarget.localName == "menu" || e.originalTarget.localName == "menuitem") return;

        if (options.onCommand)
          options.onCommand(e);

        if (options.panel) {
          options.panel.show(tbb);
        }
      }, true);
      if (options.onClick) {
          tbb.addEventListener("click", options.onClick, true); 
      }
      if (options.onContext) {
        let menupopup = doc.createElementNS(NS_XUL, "menupopup");
        let menuitem = doc.createElementNS(NS_XUL, "menuitem");
        let menuseparator = doc.createElementNS(NS_XUL, "menuseparator");
        tbb.addEventListener("contextmenu", function (e) {
          e.stopPropagation(); //Prevent Firefox context menu
          e.preventDefault();
          options.onContext(e, menupopup, menuitem, menuseparator);
          menupopup.openPopup(tbb , "after_end", 0, 0, false);
        }, true);
        tbb.appendChild(menupopup);
      }
      // add toolbarbutton to palette
      ($("navigator-toolbox") || $("mail-toolbox")).palette.appendChild(tbb);

      // find a toolbar to insert the toolbarbutton into
      if (toolbarID) {
        var tb = $(toolbarID);
      }
      if (!tb) {
        var tb = toolbarbuttonExists(doc, options.id);
      }

      // found a toolbar to use?
      if (tb) {
        let b4;

        // find the toolbarbutton to insert before
        if (insertbefore) {
          b4 = $(insertbefore);
        }
        if (!b4) {
          let currentset = tb.getAttribute("currentset").split(",");
          let i = currentset.indexOf(options.id) + 1;

          // was the toolbarbutton id found in the curent set?
          if (i > 0) {
            let len = currentset.length;
            // find a toolbarbutton to the right which actually exists
            for (; i < len; i++) {
              b4 = $(currentset[i]);
              if (b4) break;
            }
          }
          if (!b4) b4 = $("home-button");
        }

        try {
          tb.insertItem(options.id, b4, null, false);
        }
        catch(e) {
          tb.insertItem(options.id, null, null, false);
        }
      }
      // Set badge after insderting the toolbar
      if (setBadge.value) setBadge ({value: setBadge.value});
      if (setType.value) setType({value: setType.value});
      
      var saveTBNodeInfo = function(e) {
        toolbarID = tbb.parentNode.getAttribute("id") || "";
        insertbefore = (tbb.nextSibling || "")
            && tbb.nextSibling.getAttribute("id").replace(/^wrapper-/i, "");

        prefs.nextSibling = insertbefore;
        prefs.toolbarID = toolbarID;  
      };

      window.addEventListener("aftercustomization", saveTBNodeInfo, false);

      // add unloader to unload+'s queue
      var unloadFunc = function() {
        tbb.parentNode.removeChild(tbb);
        window.removeEventListener("aftercustomization", saveTBNodeInfo, false);
      };
      var index = destoryFuncs.push(unloadFunc) - 1;
      listen(window, window, "unload", function() {
        destoryFuncs[index] = null;
      }, false);
      unloaders.push(unload(unloadFunc, window));
    },
    onUntrack: function (window) {}
  };
  var tracker = winUtils.WindowTracker(delegate);

  function setType(aOptions) {
    setType.value = aOptions.value;
  
    getToolbarButtons(function(tbb) {
      tbb.setAttribute("type", aOptions.value);
    }, options.id);
    return aOptions.value;
  }
  function setBadge (aOptions) {
    setBadge.value = aOptions.value;
  
    getToolbarButtons(function(tbb) {
      if ((aOptions.value + "").length > 4) {
        aOptions.value = "9999";
      }
      tbb.setAttribute("value", aOptions.value ? aOptions.value : "");
      tbb.setAttribute("length", aOptions.value ? (aOptions.value + "").length : 0);
    }, options.id);
    return aOptions.value;
  }

  return {
    destroy: function() {
      if (destroyed) return;
      destroyed = true;

      if (options.panel)
        options.panel.destroy();

      // run unload functions
      destoryFuncs.forEach(function(f) f && f());
      destoryFuncs.length = 0;

      // remove unload functions from unload+'s queue
      unloaders.forEach(function(f) f());
      unloaders.length = 0;
    },
    moveTo: function(pos) {
      if (destroyed) return;

      // record the new position for future windows
      toolbarID = prefs.toolbarID || pos.toolbarID;
      insertbefore = prefs.nextSibling || pos.insertbefore;

      if (toolbarID == "BrowserToolbarPalette") {
        toolbarID = "nav-bar";
        insertbefore = "home-button";
      }
      
      // change the current position for open windows
      for each (var window in utils.windows()) {
        if (browserURL != window.location) return;

        let doc = window.document;
        let $ = function (id) doc.getElementById(id);

        // if the move isn't being forced and it is already in the window, abort
        if (!pos.forceMove && $(options.id)) return;

        var tb = $(toolbarID);
        var b4 = $(insertbefore);

        if (tb) {
          try {
            tb.insertItem(options.id, b4, null, false);
          }
          catch(e) {
            tb.insertItem(options.id, null, null, false);
          }
          tb.setAttribute("currentset", tb.currentSet); 
          doc.persist(tb.id, "currentset");
        }
      };
    },
    get label() options.label,
    set label(value) {
      options.label = value;
      getToolbarButtons(function(tbb) {
        tbb.label = value;
      }, options.id);
      return value;
    },
    set type(value) setType({value: value}),
    get badge () setBadge.value,
    set badge(value) setBadge({value: value}),
    get tooltiptext() options.tooltiptext,
    set tooltiptext(value) {
      options.tooltiptext = value;
      getToolbarButtons(function(tbb) {
        tbb.setAttribute('tooltiptext', value);
      }, options.id);
    },
    get object () {
      return utils.getMostRecentBrowserWindow().document.getElementById(options.id);
    }
  };
};

function getToolbarButtons(callback, id) {
  let buttons = [];
  for each (var window in utils.windows()) {
    if (browserURL != window.location) continue;
    let tbb = window.document.getElementById(id);
    if (tbb) buttons.push(tbb);
  }
  if (callback) buttons.forEach(callback);
  return buttons;
}

function toolbarbuttonExists(doc, id) {
  var toolbars = doc.getElementsByTagNameNS(NS_XUL, "toolbar");
  for (var i = toolbars.length - 1; ~i; i--) {
    if ((new RegExp("(?:^|,)" + id + "(?:,|$)")).test(toolbars[i].getAttribute("currentset")))
      return toolbars[i];
  }
  return false;
}
