/* globals safari */
'use strict';

var background = (function () {
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
  };
})();

var manifest = {
  url: safari.extension.baseURI
};
