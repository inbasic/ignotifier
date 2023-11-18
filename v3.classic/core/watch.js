/* global repeater */

/* updating badge when action is posted */
chrome.webRequest.onCompleted.addListener(d => {
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
}, {
  urls: [
    '*://mail.google.com/mail/u*',
    '*://mail.google.com/sync/u/*/i/s*',
    '*://mail.google.com/mail/logout*'
  ]},
[]);
