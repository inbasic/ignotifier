var {Cc, Ci}  = require('chrome'),
    unload    = require("sdk/system/unload");

var dock = Cc["@mozilla.org/widget/macdocksupport;1"]
  .getService(Ci.nsIMacDockSupport);

exports.set = function (badge, msg) {
  dock.badgeText = badge;
}
exports.remove = function () {
  dock.badgeText = "";
}
exports.callback = function () { }

unload.when(function () {
  exports.remove();
});