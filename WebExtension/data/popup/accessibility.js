'use strict';

// Link opener for html
{
  function opener(e) {
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
  }
  window.addEventListener('click', opener);
  qs('iframe').addEventListener('load', () => {
    qs('iframe').contentDocument.addEventListener('mousedown', opener);
  });
}

{
  function keyup(e) {
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
  }
  chrome.storage.local.get({
    keyUp: false
  }, prefs => keyup.doKeyUp = prefs.keyUp);

  window.addEventListener('keyup', keyup);
  qs('iframe').contentDocument.addEventListener('keyup', keyup);
}

window.focus();

chrome.runtime.getBackgroundPage(b => b.userActions.forEach(c => c()));
