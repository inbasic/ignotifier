/* global checkEmails, repeater */

// Reset the badge when the inbox of an account is opened. The raw unread count
// is still used by the panel; checkEmails.visit() turns the visit into a
// baseline for the button badge. The option is disabled by default.
{
  // /mail/u/0/, /mail/u/0/?shva=1#inbox, /mail/u/0/#inbox/<thread>
  const account = href => {
    if (typeof href !== 'string') {
      return;
    }
    try {
      const uri = new URL(href);
      if (uri.hostname !== 'mail.google.com') {
        return;
      }
      const m = /^\/mail\/u\/(\d+)\/?$/.exec(uri.pathname);
      if (m === null) {
        return;
      }
      const hash = uri.hash.slice(1);
      if (hash === '' || /^inbox(?:$|[\/?])/.test(hash)) {
        return Number(m[1]);
      }
    }
    catch (e) {}
  };

  const touch = n => {
    checkEmails.visit(n).then(fresh => {
      // confirm the baseline against the server; only once per visit
      if (fresh) {
        repeater.reset('inbox.visit', 1000);
      }
    }).catch(e => console.error(e));
  };

  const inspect = id => chrome.tabs.get(id, tab => {
    if (chrome.runtime.lastError) {
      return;
    }
    const n = account(tab.url);
    if (n !== undefined) {
      touch(n);
    }
  });

  chrome.tabs.onUpdated.addListener((id, info, tab) => {
    if (info.url || info.status === 'complete') {
      const n = account(info.url || tab.url);
      if (n !== undefined) {
        touch(n);
      }
    }
  });
  // switching to an inbox tab that is already open is a visit as well
  chrome.tabs.onActivated.addListener(({tabId}) => inspect(tabId));
  chrome.windows.onFocusChanged.addListener(id => {
    if (id === chrome.windows.WINDOW_ID_NONE) {
      return;
    }
    chrome.tabs.query({
      active: true,
      windowId: id
    }, ([tab]) => {
      if (tab) {
        const n = account(tab.url);
        if (n !== undefined) {
          touch(n);
        }
      }
    });
  });
}
