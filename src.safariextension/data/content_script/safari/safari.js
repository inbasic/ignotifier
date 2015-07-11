/* globals safari */
'use strict';

var background = {
  send: function (id, obj) {
    safari.self.tab.dispatchMessage('message', {
      id: id,
      data: obj
    });
  },
  receive: (function () {
    var callbacks = {};
    safari.self.addEventListener('message', function (e) {
      if (callbacks[e.name]) {
        callbacks[e.name](e.message);
      }
    }, false);

    return function (id, callback) {
      callbacks[id] = callback;
    };
  })()
};

var manifest = {
  url: safari.extension.baseURI
};
