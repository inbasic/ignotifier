/* globals chrome */
'use strict';

var background = {
  send: function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  },
  receive: function (id, callback) {
    chrome.runtime.onMessage.addListener(function (request) {
      if (request.method === id) {
        callback(request.data);
      }
    });
  }
};

(function (elems) {
  [].forEach.call(elems, function (elem) {
    elem.textContent = chrome.i18n.getMessage(elem.getAttribute('data-l10n-id'));
  });
})(document.querySelectorAll('*[data-l10n-id]'));
