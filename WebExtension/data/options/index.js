/* globals config */
'use strict';

var notify = (notify => {
  let resolve = '';
  notify.addEventListener('click', ({target}) => {
    const cmd = target.dataset.cmd;
    if (cmd) {
      notify.dataset.hidden = true;
    }
    if (cmd === 'yes' && resolve) {
      resolve();
    }
  });
  return msg => {
    notify.querySelector('div').textContent = msg;
    notify.dataset.hidden = false;
    return new Promise(r => resolve = r);
  };
})(document.getElementById('notify'));

function restore() {
  chrome.storage.local.get(config.prefs, prefs => Object.entries(prefs).forEach(([key, value]) => {
    try {
      if (config.map.checkbox.indexOf(key) === -1) {
        document.getElementById(key).value = value;
      }
      else {
        document.getElementById(key).checked = value;
      }
    }
    catch (e) {
      console.error(e);
    }
  }));
}

document.addEventListener('change', e => {
  const target = e.target;
  const key = target.id;
  let value = target.value;
  if (key && target.validity.valid) {
    if (config.map.number.indexOf(key) !== -1) {
      value = Number(value);
    }
    else if (config.map.checkbox.indexOf(key) !== -1) {
      value = target.checked;
    }
    if (/^feeds_[012345]$/.test(key)) {
      target.value = value = value.split(',')
        .map(tag => tag
        .replace(/^\s\s*/, '')
        .replace(/\s\s*$/, '')
        .replace(/\s/g, '-')
        .replace(/\//g, '-')
        .replace(/^"/g, '')
        .replace(/"$/g, '')
        .toLowerCase()
      )
      .filter(tag => tag) // remove empty tags
      .filter((t, i, a) => a.indexOf(t) === i) // remove duplicate tags
      .join(', ');
    }
    else if (key === 'feeds_custom') {
      target.value = value = target.value.split(/\s*,\s*/).map(s => {
        try {
          const uri = new URL(s);
          if (uri.protocol.startsWith('http')) {
            return s;
          }
        }
        catch (e) {}
        return '';
      }).filter(s => s).join(', ');
    }
    else if (key === 'notificationTruncate') {
      if (value % 2) { // odd number
        value += 1;
        target.value = value;
      }
    }
    else if (key.startsWith('notification.sound.media.') && key.endsWith('.type') && value === 4) {
      target.parentNode.querySelector('label').style.display = 'inline-block';
    }
    else if (key.endsWith('.file')) {
      const file = target.files[0];

      if (file.type.startsWith('audio/')) {
        const reader = new FileReader();
        reader.onload = e => {
          chrome.storage.local.set({
            [key]: e.target.result
          }, () => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              alert(lastError.message);
            }
            else {
              chrome.storage.local.set({
                [key.replace('.file', '.mime')]: file.type
              });
              target.parentNode.style.display = 'none';
            }
          });
        };
        reader.onerror = e => alert(e.meesage || e);
        reader.readAsDataURL(file);
      }
      else {
        window.alert(`This file is not supported. Mime-type is "${file.type}"`);
      }
      return;
    }
console.log(key, value);
    chrome.storage.local.set({
      [key]: value
    });
  }
});

document.addEventListener('input', ({target}) => {
  const key = target.id;
  if (key === 'resetPeriod') {
    const value = Number(target.value);
    target.setCustomValidity(value === 0 || value > 4 ? '' : 'Value must be zero or greater than 4');
  }
});

document.addEventListener('DOMContentLoaded', restore);

document.getElementById('reset').addEventListener('click', () => {
  notify('Are you sure you want to reset all the preferences back to the default values?').then(() => {
    chrome.storage.local.set(config.prefs, () => window.location.reload());
  });
});

document.getElementById('test-play').addEventListener('click', () => chrome.runtime.sendMessage({
  method: 'test-play'
}));

// pref changes
chrome.storage.onChanged.addListener(prefs => {
  chrome.runtime.getBackgroundPage(b => {
    if (prefs.resetPeriod) {
      if (prefs.resetPeriod.newValue) {
        b.resetTimer.fill(prefs.resetPeriod.newValue * 1000 * 60);
        b.resetTimer.reset();
      }
      else {
        b.resetTimer.stop();
      }
    }
    if (prefs.oldFashion) {
      const numberOfAccounts = b.checkEmails.getCached()
        .map(o => o.xml ? o.xml.title : null)
        .filter((o, i, a) => o && a.indexOf(o) === i)
        .length;
      const hasUnread = b.checkEmails.getCached()
        .map(o => o.xml ? o.xml.fullcount : 0)
        .reduce((p, c) => p + c, 0);
      if (numberOfAccounts === 1 && prefs.oldFashion.newValue === 1) {
        b.app.popup.detach();
      }
      else if (hasUnread) {
        b.app.popup.attach();
      }
    }
    if (prefs.minimal ||
      prefs.feeds_0 || prefs.feeds_1 || prefs.feeds_2 || prefs.feeds_3 || prefs.feeds_4 || prefs.feeds_5 ||
      prefs.feeds_custom
    ) {
      b.repeater.reset();
    }
    if (prefs.clrPattern || prefs.badge) {
      b.actions.reset();
    }
    if (prefs.period) {
      b.repeater.fill(prefs.period.newValue * 1000);
    }
    if (prefs.backgroundColor) {
      b.toolbar.color = prefs.backgroundColor.newValue;
    }
  });
});

document.getElementById('donation').href = chrome.runtime.getManifest().homepage_url + '?rd=donate';
