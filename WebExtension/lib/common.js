/* globals app, config, timer, checkEmails, server, contextmenu, toolbar */
'use strict';

var repeater; // main repeater
var resetTimer; // periodic repeater

// disable sound on a user action
app.actions(() => app.sound.stop());

var actions = {
  silent: time => {
    if (time === 'custom') {
      time = config.notification.silentTime * 60;
    }
    config.notification.silent = window
      .setTimeout(() => config.notification.silent = false, time * 1000);
  },
  reset: () => repeater.reset(true),
  onCommand: link => open(link || config.email.url)
};

function play(arr = []) {
  const media = config.notification.sound.media;
  const filters = [0, 1, 2, 3, 4].map(index => ({
    filter: media['custom' + index].filter,
    selector: media['custom' + index].selector,
    index
  })).filter(o => o.filter).filter(obj => {
    if (obj.selector === 0) {
      return arr.reduce(function(p, c) {
        return p || (
          c.author_email.toLowerCase().indexOf(obj.filter.toLowerCase()) !== -1 ||
          c.author_name.toLowerCase().indexOf(obj.filter.toLowerCase()) !== -1
        );
      }, false);
    }
    if (obj.selector === 1) {
      return arr.reduce(function(p, c) {
        return p || c.title.toLowerCase().indexOf(obj.filter.toLowerCase()) !== -1;
      }, false);
    }
    if (obj.selector === 2) {
      return arr.reduce(function(p, c) {
        return p || c.summary.toLowerCase().indexOf(obj.filter.toLowerCase()) !== -1;
      }, false);
    }
    return false;
  });
  app.sound.play(filters.length ? filters[0].index : null);
}

function open(url, inBackground, refresh) {
  url = url.replace('@private', ''); // some urls might end with "@private" for private mode
  function parseUri(str) {
    const uri = new URL(str);
    if (uri.hostname.startsWith('mail.google')) {
      uri.messageId = (/message_id=([^&]*)|#[^/]*\/([^&]*)/.exec(uri.hostname) || [])[1] || uri.hash.split('/')[1];
      uri.label = (/#([^/]*)/.exec(str) || [])[1];
    }
    return uri;
  }

  (new Promise(resolve => {
    if (config.tabs.ignoreOpens) {
      resolve([]);
    }
    const options = {};
    if (config.tabs.search) {
      options.currentWindow = true;
    }
    chrome.tabs.query(options, tabs => resolve(tabs));
  })).then(tabs => {
    const parse2 = parseUri(url);

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      if (tab.url === url) {
        if (config.tabs.NotifyGmailIsOpen && tab.active) {
          app.notify(app.l10n('msg_1'));
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
        const reload = parse2.messageId && tab.url.indexOf(parse2.messageId) === -1 || refresh;
        if (tab.active && !reload) {
          if (config.tabs.NotifyGmailIsOpen) {
            app.notify(app.l10n('msg_1'));
          }
        }
        else if (tab.active && reload) {
          chrome.tabs.update(tab.id, {url});
        }
        if (tab.active === false) {
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
        }
        return;
      }
    }
    if (config.tabs.open.mode === 2) {
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, ([tab]) => chrome.tabs.update(tab.id, {url}));
    }
    else if (config.tabs.open.mode === 0) {
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, ([tab]) => {
        const options = {
          url,
          active: typeof inBackground === 'undefined' ? !config.tabs.open.background : !inBackground
        };
        if (config.tabs.open.relatedToCurrent) {
          options.index = tab.index + 1;
        }
        chrome.tabs.create(options);
      });
    }
    else {
      chrome.windows.create({
        url,
        focused: typeof inBackground === 'undefined' ? !config.tabs.open.background : !inBackground
      });
    }
  });
}

var checkEmails = (function() {
  let color = 'blue';
  let count = -1;
  let cachedEmails;
  let emails;
  let feeds = '';
  let isPrivate = app.isPrivate();

  return {
    execute: function(forced) {
      if (forced) {
        toolbar.icon = 'load';
        toolbar.badge = 0;
        color = 'load';
      }
      // Cancel previous execution?
      if (emails && emails.length) {
        emails.forEach(e => e.reject());
      }

      if (config.email.feeds.join(', ') !== feeds || isPrivate !== app.isPrivate()) {
        isPrivate = app.isPrivate();
        emails = config.email.feeds.map(function(feed) {
          return new server.Email(feed, config.email.timeout);
        });
        // supporting private mode
        if (app.isPrivate()) {
          emails = emails.concat(config.email.feeds.map(function(feed) {
            return new server.Email(feed, config.email.timeout, true);
          }));
        }

        feeds = config.email.feeds.join(', ');
      }
      // Execute fresh servers
      Promise.all(emails.map(function(e) {
        return e.execute().catch(() => {});
      })).then(objs => { // Removing error objects
        objs = objs.filter(o => o);
        // Make sure there is no duplicate account
        let tmp = objs
          .map(o => (o.notAuthorized === true || o.network === false) ? null : (o.xml ? o.xml.title + '/' + o.xml.label : null))
          .map((l, i, a) => !l ? false : a.indexOf(l) !== i);
        tmp.forEach(function(v, i) {
          if (!v) {
            return;
          }
          objs[i].notAuthorized = true;
          objs[i].xml = null;
          objs[i].newIDs = [];
        });

        var isAuthorized = objs.reduce(function(p, c) {
          return p || (!c.notAuthorized && c.network);
        }, false);
        var anyNewEmails = objs.reduce(function(p, c) {
          return p || (c.newIDs.length !== 0);
        }, false);
        if (!isAuthorized) {
          if (color !== 'blue') {
            toolbar.icon = 'blue';
            toolbar.badge = 0;
            color = 'blue';
            count = -1;
            cachedEmails = [];
            contextmenu.fireContext();
            app.popup.detach();
          }
          if (forced) {
            open(config.email.url);
            app.notify(app.l10n('log_into_your_account'));
          }
          toolbar.label = config.labels.tooltip;
          app.popup.detach();
          return;
        }
        //Removing not logged-in accounts
        objs = objs.filter(function(o) {
          return o.network && !o.notAuthorized && o.xml && o.xml.entries;
        });
        //Sorting accounts
        objs.sort(function(a, b) {
          var var1 = config.email.alphabetic ? a.xml.title : a.xml.link;
          var var2 = config.email.alphabetic ? b.xml.title : b.xml.link;
          if (var1 > var2) {
            return 1;
          }
          if (var1 < var2) {
            return -1;
          }
          return 0;
        });
        // New total count number
        var newCount = objs.reduce(function(p, c) {
          return p + c.xml.fullcount;
        }, 0);
        //
        if (!anyNewEmails && !forced && count === newCount) {
          app.popup.send('update-date', objs); //Updating the date of the panel
          return; //Everything is clear
        }
        count = newCount;
        //
        cachedEmails = objs;
        contextmenu.fireContext();
        // Preparing the report
        tmp = [];
        objs.forEach(function(o) {
          (o.xml && o.xml.entries ? o.xml.entries : [])
            .filter(function(e) {
              return anyNewEmails ? o.newIDs.indexOf(e.id) !== -1 : o.xml.fullcount !== 0;
            })
            .splice(0, config.email.maxReport)
            .forEach(e => tmp.push(e));
        });
        function shorten(str) {
          if (str.length < config.email.truncate) {
            return str;
          }
          return str.substr(0, config.email.truncate / 2) + '...' + str.substr(str.length - config.email.truncate / 2);
        }
        var report = tmp.map(e => config.notification.format
          .replace('[author_name]', e.author_name)
          .replace('[author_email]', e.author_email)
          .replace('[summary]', shorten(e.summary))
          .replace('[title]', shorten(e.title))
          .replace(/\[break\]/g, '\n'));

        if (config.notification.combined) {
          report = [report.join('\n\n')];
        }
        // Preparing the tooltip
        var tooltip =
          app.l10n('gmail') + '\n\n' +
          objs.reduce(function(p, c) {
            return p +=
              c.xml.title +
              (c.xml.label ? ' [' + c.xml.label + ']' : '') +
              ' (' + c.xml.fullcount + ')\n';
          }, '').replace(/\n$/, '');
        const singleAccount = config.email.openInboxOnOne === 1 &&
          objs.map(o => o.xml.rootLink).filter((s, i, l) => l.indexOf(s) === i).length === 1;
        console.log(singleAccount, objs.map(o => o.xml.rootLink).filter((s, i, l) => l.indexOf(s) === i).length)
        if (!forced && !anyNewEmails) {
          if (newCount) {
            toolbar.icon = 'red';
            toolbar.badge = newCount;
            color = 'red';
            toolbar.label = tooltip;
            app.popup.send('update', objs);
            if (singleAccount) {
              app.popup.detach();
            }
            else {
              app.popup.attach();
            }
          }
          else {
            toolbar.icon = 'gray';
            toolbar.badge = 0;
            color = 'gray';
            toolbar.label = tooltip;
            app.popup.detach();
          }
        }
        else if (forced && !newCount) {
          toolbar.icon = 'gray';
          toolbar.badge = 0;
          color = 'gray';
          toolbar.label = tooltip;
          app.popup.detach();
        }
        else {
          toolbar.icon = 'new';
          toolbar.badge = newCount;
          color = 'new';
          if (singleAccount) {
            app.popup.detach();
          }
          else {
            app.popup.attach();
          }
          if (config.notification.show) {
            // this most likely is the account that user wants to reach!
            const link = tmp[0].link.split('?')[0];
            app.notify(report, '', open.bind(null, link));
          }
          if (config.notification.sound.play) {
            play(tmp);
          }
          toolbar.label = tooltip;
          app.popup.send('update-reset', objs);
        }
      }, function() {
        // this should not be called
      });
    },
    getCached: () => cachedEmails || []
  };
})();

// user interactions
chrome.browserAction.onClicked.addListener(() => actions.onCommand());

// start up
app.on('load', () => {
  // add a repeater to check all accounts
  repeater = new timer.repeater(
    (config.email.check.first ? config.email.check.first : 5) * 1000,
    config.email.check.period * 1000
  );

  repeater.on(checkEmails.execute);
  if (config.email.check.first === 0) {  // manual mode
    repeater.stop();
  }
  // periodic reset
  resetTimer = new timer.repeater(
    config.email.check.resetPeriod * 1000 * 60,
    config.email.check.resetPeriod * 1000 * 60
  );
  resetTimer.on(actions.reset);
  if (config.email.check.resetPeriod === 0) {
    resetTimer.stop();
  }
});

// updates
app.on('update', () => repeater.reset());
// messaging
chrome.runtime.onMessage.addListener(request => {
  const method = request.method;
  if (method === 'update' && request.forced) {
    repeater.reset(true);
  }
  else if (method === 'update') {
    window.setTimeout(() => repeater.reset(), 500);
  }
  else if (method === 'open') {
    const url = request.url;
    if (typeof url === 'string') {
      open(url);
    }
    else if (url.button === 2 || !url.link) {
      return;
    }
    else if (url.button === 0 && (url.ctrlKey || url.metaKey)) {
      open(url.link, true, null, url.isPrivate);
    }
    else if (url.button === 1) {
      open(url.link, true, null, url.isPrivate);
    }
    else {
      open(url.link, null, null, url.isPrivate);
    }
  }
  else if (method === 'test-play') {
    play(null);
  }
});

// pref changes
chrome.storage.onChanged.addListener(prefs => {
  if (prefs.resetPeriod) {
    if (prefs.resetPeriod.newValue) {
      resetTimer.fill(prefs.resetPeriod.newValue * 1000 * 60);
      resetTimer.reset();
    }
    else {
      resetTimer.stop();
    }
  }
  if (prefs.oldFashion) {
    const numberOfAccounts = checkEmails.getCached()
      .map(o => o.xml ? o.xml.title : null)
      .filter((o, i, a) => o && a.indexOf(o) === i)
      .length;
    const hasUnread = checkEmails.getCached()
      .map(o => o.xml ? o.xml.fullcount : 0)
      .reduce((p, c) => p + c, 0);
    if (numberOfAccounts === 1 && prefs.oldFashion.newValue === 1) {
      app.popup.detach();
    }
    else if (hasUnread) {
      app.popup.attach();
    }
  }
  if (prefs.minimal ||
    prefs.feeds_0 || prefs.feeds_1 || prefs.feeds_2 || prefs.feeds_3 || prefs.feeds_4 || prefs.feeds_5 ||
    prefs.feeds_custom
  ) {
    repeater.reset();
  }
  if (prefs.clrPattern) {
    actions.reset();
  }
  if (prefs.period) {
    repeater.fill(prefs.period.newValue * 1000);
  }
  if (prefs.backgroundColor) {
    toolbar.color = prefs.backgroundColor.newValue;
  }
});

// FAQs & Feedback & init
app.on('load', () => {
  const prefs = config.prefs;
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.welcome && prefs.version !== version) : true) {
    chrome.storage.local.set({version}, () => {
      if (version.indexOf('b') !== -1) {
        return;
      }
      chrome.tabs.create({
        url: 'http://add0n.com/gmail-notifier.html?version=' + version +
          '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
      });
    });
  }
});
{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://add0n.com/feedback.html?name=' + name + '&version=' + version);
}
