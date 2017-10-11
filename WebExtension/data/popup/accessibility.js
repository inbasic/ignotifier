/* globals qs, isPrivate */
'use strict';

// Link opener for html
{
  function opener(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target;

    const link = (target.closest('a') && target.closest('a').href) || target.src || target.href;

    if (link) {
      chrome.runtime.sendMessage({
        method: 'open',
        url: {
          isPrivate,
          link,
          button: e.button,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey
        }
      }, () => window.close());
    }
  }
  window.addEventListener('click', opener);
  qs('iframe').contentDocument.addEventListener('click', opener);
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
