'use strict';

var os = require('sdk/system').platform;

exports.tray = (function () {
  let callback = function () {};
  let module;

  if (os !== 'winnt' && os !== 'darwin') {
    return {
      set: function () {},
      remove: function () {},
      callback: function () {}
    };
  }

  return {
    set: (a, b) => {
      if (!module) {
        module = require('./' + os + '/tray');
        module.callback(callback);
      }
      module.set(a, b);
    },
    remove: () => module ? module.remove() : null,
    callback: (c) => callback = c
  };
})();
