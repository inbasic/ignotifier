{
  const parseUri = str => {
    const uri = new URL(str);
    if (uri.hostname.startsWith('mail.google')) {
      uri.messageId = (/message_id=([^&]*)|#[^/]*\/([^&]*)/.exec(uri.href) || [])[1] || uri.hash.split('/').pop();
      {
        const a = uri.hash.substr(1).replace('label/', '').split('/');
        a.pop();
        uri.label = a.length ? a.join('/') : '';
      }
    }
    return uri;
  };
  const notify = message => chrome.notifications.create({
    type: 'basic',
    iconUrl: '/data/icons/notification/48.png',
    title: chrome.i18n.getMessage('gmail'),
    message: message || 'Unknown Error - 3'
  });

  self.openLink = (url, inBackground, refresh) => {
    url = url.replace('@private', ''); // some urls might end with "@private" for private mode

    chrome.storage.local.get({
      'ignoreOpens': false,
      'searchMode': true, // true: current window only, false: all open windows
      'basic.html': false,
      'onGmailNotification': true,
      'currentTab': false,
      'newWindow': false,
      'relatedToCurrent': false,
      'background': false
    }, async prefs => {
      const mode = prefs.currentTab ? 2 : (prefs.newWindow ? 1 : 0);

      const tabs = prefs.ignoreOpens ? [] : await new Promise(resolve => {
        const options = {};
        if (prefs.searchMode) {
          options.currentWindow = true;
        }
        chrome.tabs.query(options, tabs => resolve(tabs.filter(t => t.url)));
      });

      const parse2 = parseUri(url);
      // support for basic HTML
      if (parse2.messageId && prefs['basic.html']) {
        url = `${parse2.origin}${parse2.pathname}/h/?&th=${parse2.messageId}&v=c`.replace('//h', '/h');
        if (parse2.label) {
          url += '&s=l&l=' + parse2.label;
        }
      }

      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        if (tab.url === url) {
          if (prefs.onGmailNotification && tab.active) {
            notify(chrome.i18n.getMessage('msg_1'));
          }
          const options = {
            active: true
          };
          if (refresh) {
            options.url = url;
          }
          chrome.tabs.update(tab.id, options);
          chrome.windows.update(tab.windowId, {
            focused: true
          });
          return;
        }
        const parse1 = parseUri(tab.url);
        // Only if Gmail
        if (
          parse1.hostname.startsWith('mail.google') &&
          parse1.hostname === parse2.hostname &&
          parse1.pathname.indexOf(parse2.pathname) === 0 &&
          !/to=/.test(url) &&
          !/view=cm/.test(url)
        ) {
          const reload = refresh ||
            (parse2.messageId && tab.url.indexOf(parse2.messageId) === -1) ||
            (parse1.messageId && !parse2.messageId); // when opening INBOX when a thread page is open

          if (tab.active && !reload) {
            if (prefs.onGmailNotification) {
              notify(chrome.i18n.getMessage('msg_1'));
            }
          }
          const options = {
            active: true
          };
          if (reload) {
            options.url = url;
          }
          chrome.tabs.update(tab.id, options);
          chrome.windows.update(tab.windowId, {
            focused: true
          });

          return;
        }
      }
      if (mode === 2) {
        chrome.tabs.query({
          active: true,
          currentWindow: true
        }, ([tab]) => chrome.tabs.update(tab.id, {url}));
      }
      else if (mode === 0) {
        chrome.tabs.query({
          active: true,
          currentWindow: true
        }, ([tab]) => {
          const options = {
            url,
            active: typeof inBackground === 'undefined' ? !prefs.background : !inBackground
          };
          if (prefs.relatedToCurrent) {
            options.index = tab.index + 1;
          }
          chrome.tabs.create(options);
        });
      }
      else {
        chrome.windows.create({
          url,
          focused: typeof inBackground === 'undefined' ? !prefs.background : !inBackground
        });
      }
    });
  };
}
