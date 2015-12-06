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

script('../../lib/wrapper/safari/i18next-1.7.4.js', function () {
  i18n.init({
    resGetPath: '../../_locales/en/messages.json'
  }, function () {
    var elems = document.querySelectorAll('*[data-l10n-id]');
    [].forEach.call(elems, function (elem) {
      elem.textContent = i18n.t(elem.getAttribute('data-l10n-id') + '.message');
    });
  });
});
