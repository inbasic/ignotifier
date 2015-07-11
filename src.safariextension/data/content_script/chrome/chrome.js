/* globals chrome */
'use strict';

var background = {
  send: function (id, data) {
    chrome.runtime.sendMessage({method: id, data: data});
  },
  receive: function (id, callback) {
    chrome.runtime.onMessage.addListener(function (request, sender) {
      if (request.method === id && !sender.url) { // background does not have url
        callback(request.data);
      }
    });
  }
};
var manifest = {
  url: chrome.extension.getURL('./')
};
