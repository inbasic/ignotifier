'use strict';

var locale = {
  get: chrome.i18n.getMessage
};

(elems => {
  elems.forEach(elem => {
    const att = elem.dataset.l10nValue;
    const value = locale.get(elem.dataset.l10nId);
    if (att) {
      elem.setAttribute(att, value);
    }
    else {
      elem.textContent = value;
    }
  });
})([...document.querySelectorAll('[data-l10n-id]')]);
