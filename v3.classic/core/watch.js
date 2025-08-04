/* global repeater */

/* updating badge when action is posted */

{
  const observe = d => {
    if (d.tabId) {
      if (
        d.type === 'main_frame' ||
        d.url.includes('&act=') ||
        (d.url.includes('/sync/u/') && d.method === 'POST') ||
        (d.url.includes('/mail/u/') && d.method === 'POST')
      ) {
        repeater.reset('webrequest', 1000);
      }
    }
  };

  const run = b => {
    chrome.webRequest.onCompleted.removeListener(observe);
    if (b) {
      chrome.webRequest.onCompleted.addListener(observe, {
        urls: [
          '*://mail.google.com/mail/u*',
          '*://mail.google.com/sync/u/*/i/s*',
          '*://mail.google.com/mail/logout*'
        ]},
      []);
    }
  };

  chrome.storage.local.get({
    'network.watch': true
  }).then(prefs => {
    run(prefs['network.watch']);
  });

  chrome.storage.onChanged.addListener(ps => {
    if ('network.watch' in ps) {
      run(ps['network.watch'].newValue);
    }
  });
}
