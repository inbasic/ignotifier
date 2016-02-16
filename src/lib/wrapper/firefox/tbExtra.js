'use strict';

var {Cu} = require('chrome'),
    self       = require('sdk/self'),
    unload     = require('sdk/system/unload');

const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

var onContext, onClick, button;

(function (listen) {
  let {CustomizableUI} = Cu.import('resource:///modules/CustomizableUI.jsm');
  CustomizableUI.addListener(listen);
  unload.when(() => CustomizableUI.removeListener(listen));
})({
  onWidgetBeforeDOMChange: function (tbb) {
    if (tbb.id.indexOf(self.name) === -1) {
      return;
    }
    // Install onContext if it is not installed
    if (!tbb.isOnContextInstalled) {
      tbb.isOnContextInstalled = true;

      let doc = tbb.ownerDocument.defaultView.document;
      let menupopup = doc.createElementNS(NS_XUL, 'menupopup');
      let menu = doc.createElementNS(NS_XUL, 'menu');
      let menuitem = doc.createElementNS(NS_XUL, 'menuitem');
      let menuseparator = doc.createElementNS(NS_XUL, 'menuseparator');

      tbb.addEventListener('contextmenu', function (e) {
        if (onContext) {
          //Prevent Firefox context menu
          e.stopPropagation();
          e.preventDefault();
          onContext(e, menupopup, menuitem, menuseparator, menu);
          menupopup.openPopup(tbb , 'after_end', 0, 0, false);
        }
      }, true);
      tbb.addEventListener('popuphidden', function () {
        if (button) {
          button.state('window', {
            checked: false
          });
        }
      });
      tbb.addEventListener('click', function (e) {
        if (onClick) {
          onClick(e);
        }
      }, true);
      tbb.appendChild(menupopup);
    }
  }
});

exports.onContext = (c) => onContext = c;
exports.onClick = (c) => onClick = c;
exports.attach = (b) => button = b;
