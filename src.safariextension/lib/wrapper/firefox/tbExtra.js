var {Cc, Ci, Cu, components} = require('chrome'),
    system     = require("sdk/system"),
    self       = require("sdk/self"),
    data       = self.data,
    timer      = require("sdk/timers"),
    base64     = require("sdk/base64"),
    unload     = require("sdk/system/unload"),
    userstyles = require("./userstyles"),
    is36       = Cc["@mozilla.org/xpcom/version-comparator;1"]
      .getService(Ci.nsIVersionComparator)
      .compare(system.version, "36.0") >= 0,
    id         = ('action-button--' + self.id.toLowerCase()+ '-' + self.name)
      .replace(/[^a-z0-9_-]/g, '');

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var button, badge = 0, onContext, onClick;

Cu.import("resource:///modules/CustomizableUI.jsm");

var listen = {
  onWidgetBeforeDOMChange: function(tbb, aNextNode, aContainer, aIsRemoval) {
    if (tbb.id !== id) return;
    // Set badge
    if (badge && !is36) {
      timer.setTimeout(exports.setBadge, 500, badge);
    }
    // Install onContext if it is not installed
    if (!tbb.isOnContextInstalled) {
      tbb.isOnContextInstalled = true;

      let doc = tbb.ownerDocument.defaultView.document;
      let menupopup = doc.createElementNS(NS_XUL, "menupopup");
      let menu = doc.createElementNS(NS_XUL, "menu");
      let menuitem = doc.createElementNS(NS_XUL, "menuitem");
      let menuseparator = doc.createElementNS(NS_XUL, "menuseparator");

      tbb.addEventListener("contextmenu", function (e) {
        if (onContext) {
          //Prevent Firefox context menu
          e.stopPropagation();
          e.preventDefault();
          onContext(e, menupopup, menuitem, menuseparator, menu);
          menupopup.openPopup(tbb , "after_end", 0, 0, false);
        }
      }, true);
      tbb.addEventListener("click", function (e) {
        if (onClick) {
          onClick(e);
        }
      }, true);
      tbb.appendChild(menupopup);
    }
  }
}
CustomizableUI.addListener(listen);
unload.when(function () {
  CustomizableUI.removeListener(listen);
  CustomizableUI.destroyWidget(id);
});

exports.setBadge = (function () {
  if(is36) {
    return function (val) {
      badge = val;
      if (button) {
        button.badge = val ? val : "";
        button.badgeColor = config.ui.backgroundColor;
      }
    }
  }
  else {
    Cu.import("resource://gre/modules/FileUtils.jsm");
    Cu.import("resource://gre/modules/NetUtil.jsm");

    NetUtil.asyncFetch(data.url("./firefox/overlay.css"), function(inputStream, status) {
      if (!components.isSuccessCode(status)) {
        return;
      }
      var css = NetUtil.readInputStreamToString(inputStream, inputStream.available());
      css = css
        .replace(/__extra__/g, config.ui.extra) // need to be first
        .replace(/__id__/g, "#" + id)
        .replace(/__font_family__/g, config.ui.fontFamily)
        .replace(/__font_size__/g, config.ui.fontSize)
        .replace(/__height__/g, config.ui.height)
        .replace(/__line_height__/g, config.ui.lineHeight)
        .replace(/__margin_1__/g, config.ui.margin["1"])
        .replace(/__margin_2__/g, config.ui.margin["2"])
        .replace(/__margin_3__/g, config.ui.margin["3"])
        .replace(/__margin_4__/g, config.ui.margin["4"])
        .replace(/__width_1__/g, config.ui.width["1"])
        .replace(/__width_2__/g, config.ui.width["2"])
        .replace(/__width_3__/g, config.ui.width["3"])
        .replace(/__width_4__/g, config.ui.width["4"])
        .replace(/__bg_color__/g, config.ui.backgroundColor)
        .replace(/__color__/g, config.ui.color);

      userstyles.load("data:text/css;base64," + base64.encode(css));
    });

    return function (value) {
      badge = value;
      var bb = CustomizableUI.getWidget(id);
      if (!bb) return;
      if ((value + "").length > 4) {
        value = "9999";
      }
      bb.instances.forEach(function (i) {
        var tbb = i.anchor.ownerDocument.defaultView.document.getElementById(id);
        if (!tbb) return;
        tbb.setAttribute("value", value ? value : "");
        tbb.setAttribute("length", value ? (value + "").length : 0);
      });
    }
  }
})();

exports.onContext = function (c) {
  onContext = c;
};
exports.onClick = function (c) {
  onClick = c;
};
exports.setButton = function (b) {
  button = b;
};
