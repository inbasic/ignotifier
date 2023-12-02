/* global checkEmails, repeater, sound, offscreen */

self.importScripts('/core/utils/log.js');
self.importScripts('/core/open.js');
self.importScripts('/core/offscreen.js');
self.importScripts('/core/context.js');
self.importScripts('/core/button.js');
self.importScripts('/core/sound.js');
self.importScripts('/core/check.js');
self.importScripts('/core/repeater.js');
self.importScripts('/core/watch.js');

const onClicked = link => {
  if (link) {
    self.openLink(link);
    return;
  }
  chrome.storage.local.get({
    'url': 'https://mail.google.com/mail/u/0',
    'smartOpen': true
  }, async prefs => {
    if (prefs.smartOpen) {
      try {
        const objs = await checkEmails.getCached();
        if (objs && objs.length) {
          // Selected account
          const unreadEntries = [].concat([], ...objs.map(obj => obj.xml.entries));
          // selecting the correct account
          if (unreadEntries.length) {
            const newestEntry = unreadEntries.sort((p, c) => {
              const d1 = new Date(p.modified);
              const d2 = new Date(c.modified);
              return d1 < d2;
            })[0];
            if (newestEntry) {
              return self.openLink(newestEntry.link);
            }
          }
          try {
            return self.openLink(objs[0].xml.entries[0].link);
          }
          catch (e) {}
        }
      }
      catch (e) {}
    }
    return self.openLink(prefs.url);
  });
};

// user interactions
chrome.action.onClicked.addListener(() => onClicked());

// messaging
chrome.runtime.onMessage.addListener((request, sender, response) => {
  const method = request.method;

  if (method === 'update' && request.forced) {
    repeater.reset('popup.forced');
  }
  else if (method === 'update') {
    repeater.reset('popup', 500);
  }
  else if (method === 'open') {
    const url = request.url;
    if (typeof url === 'string') {
      self.openLink(url);
    }
    else if (url.button === 2 || !url.link) {
      return;
    }
    else if (url.button === 0 && (url.ctrlKey || url.metaKey)) {
      self.openLink(url.link, true, null, url.isPrivate);
    }
    else if (url.button === 1) {
      self.openLink(url.link, true, null, url.isPrivate);
    }
    else {
      self.openLink(url.link, null, null, url.isPrivate);
    }
  }
  else if (method === 'test-play') {
    sound.play();
  }
  else if (method === 'gmail.action') {
    chrome.storage.local.get({
      doReadOnArchive: true
    }, prefs => {
      request.prefs = prefs;
      offscreen.command({
        cmd: 'gmail.action',
        request
      }).then(e => {
        if (e === true) {
          response();
        }
        else {
          console.error(e);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: '/data/icons/notification/48.png',
            title: chrome.i18n.getMessage('gmail'),
            message: e.message || 'Unknown Error - 1'
          });
          response(e);
        }
      }).finally(() => repeater.reset('popup.action', 500));
    });

    return true;
  }
  else if (method === 'gmail.search') {
    offscreen.command({
      cmd: 'gmail.search',
      request
    }).then(r => {
      if (!r) {
        response();
        console.error('Empty response from offscreen');
      }
      else if (r.message) {
        response();
        console.error(r);
      }
      else {
        response(r.entries);
      }
    });
    return true;
  }
  else if (method === 'stop-sound') {
    sound.stop();
  }
  else if (method === 'get-at') {
    chrome.cookies.get({name: 'GMAIL_AT', url: 'https://mail.google.com/mail/u/' + request.n}, o => {
      response(o?.value);
    });
    return true;
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
