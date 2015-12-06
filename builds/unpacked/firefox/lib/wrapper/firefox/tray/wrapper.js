var {Cc, Ci, Cu} = require('chrome'),
    os           = require("sdk/system").platform,
    config       = require('../../../config');

var tray = (function () {
  if (os === "winnt") {
    return require('./winnt/tray');
  }
  if (os === "darwin") {
    return require('./darwin/tray');
  }
  return {
    set: function () {},
    remove: function () {},
    callback: function () {}
  };
})();

exports.tray = tray;