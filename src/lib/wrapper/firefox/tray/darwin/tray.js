'use strict';

var {Cc, Ci}  = require('chrome'),
    unload    = require('sdk/system/unload'),
    config    = require('../../../../config');

var dock = Cc['@mozilla.org/widget/macdocksupport;1']
  .getService(Ci.nsIMacDockSupport);

exports.set = function (badge) {
  if(!config.tray.show) {
    return;
  }
  dock.badgeText = badge;
};
exports.remove = function () {
  dock.badgeText = '';
};
exports.callback = function () {};

unload.when(exports.remove);
