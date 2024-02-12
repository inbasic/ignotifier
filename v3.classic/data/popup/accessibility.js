/* global qs */
'use strict';

// Link opener for html
const opener = self.opener = e => {
  const target = e.target;

  const a = target.closest('a') || target;
  const link = a.dataset.href || a.href || a.src || target.src || target.href;

  if (link) {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      method: 'open',
      url: {
        link,
        button: e.button,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey
      }
    }, () => e.button === 0 ? window.close() : null);
  }
};
addEventListener('click', opener);

// Support Gmail's keyboard shortcuts on the panel
const keyup = self.keyup = e => {
  if (!keyup.doKeyUp) {
    return;
  }

  if (e.keyCode === 49 && e.shiftKey) {
    qs('spam').click();
  }
  if (e.keyCode === 51 && e.shiftKey) {
    qs('trash').click();
  }
  if (e.keyCode === 73 && e.shiftKey) {
    qs('read').click();
  }
  if (e.keyCode === 69) {
    qs('archive').click();
  }
};
chrome.storage.local.get({
  keyUp: false
}, prefs => keyup.doKeyUp = prefs.keyUp);

addEventListener('keyup', keyup);

window.focus();

chrome.runtime.sendMessage({
  method: 'stop-sound'
});
