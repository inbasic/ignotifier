var isFirefox = typeof require !== 'undefined';
if (isFirefox) {
  app = require('../wrapper/firefox/app');
  tab = exports;
}
else {
  var tab = {};
}