/* globals chrome */
'use strict';

var background = {
  send: function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  },
  receive: function (id, callback) {
    if (id === 'show') {
      window.addEventListener('load', function () {
        background.send('show');
        callback();
      }, false);
    }
    else {
      chrome.extension.onRequest.addListener(function (request) {
        if (request.method === id) {
          callback(request.data);
        }
      });
    }
  }
};

var manifest = {
  url: chrome.extension.getURL(''),
  locale: chrome.i18n.getMessage
};

(function (elems) {
  [].forEach.call(elems, function (elem) {
    elem.textContent = chrome.i18n.getMessage(elem.getAttribute('data-l10n-id'));
  });
})(document.querySelectorAll('*[data-l10n-id]'));

chrome.extension.getBackgroundPage().userActions.forEach(function (callback) {
  callback();
});
