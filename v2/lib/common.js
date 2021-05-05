/* globals app, config, timer, server, contextmenu, toolbar, gmail */
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
  onCommand: link => {
    if (link) {
      open(link);
    }
    else if (config.tabs.open.smart) {
      try {
        const objs = checkEmails.getCached();
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
              return open(newestEntry.link);
            }
          }
          return open(objs[0].xml.entries[0].link);
        }
      }
      catch (e) {}
    }
    return open(config.email.url);
  }
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
      uri.messageId = (/message_id=([^&]*)|#[^/]*\/([^&]*)/.exec(uri.href) || [])[1] || uri.hash.split('/').pop();
      {
        const a = uri.hash.substr(1).replace('label/', '').split('/');
        a.pop();
        uri.label = a.length ? a.join('/') : '';
      }
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
    // support for basic HTML
    if (parse2.messageId && config.email.basic) {
      url = `${parse2.origin}${parse2.pathname}/h/?&th=${parse2.messageId}&v=c`.replace('//h', '/h');
      if (parse2.label) {
        url += '&s=l&l=' + parse2.label;
      }
    }

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
        const reload = refresh ||
          (parse2.messageId && tab.url.indexOf(parse2.messageId) === -1) ||
          (parse1.messageId && !parse2.messageId); // when opening INBOX when a thread page is open

        if (tab.active && !reload) {
          if (config.tabs.NotifyGmailIsOpen) {
            app.notify(app.l10n('msg_1'));
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
        // Removing not logged-in accounts
        objs = objs.filter(function(o) {
          return o.network && !o.notAuthorized && o.xml && o.xml.entries;
        });
        // Sorting accounts
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
        cachedEmails = objs;
        //
        if (!anyNewEmails && !forced && count === newCount) {
          app.popup.send('update-date', objs); // Updating the date of the panel
          app.popup.send('validate-current', objs); // maybe the current email is marked as read but still count is 20 (max value for non inbox labels)
          return; // Everything is clear
        }
        count = newCount;
        //
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
        let singleAccount = false;
        if (config.email.openInboxOnOne === 1) {
          singleAccount = objs.map(o => o.xml.rootLink).filter((s, i, l) => l.indexOf(s) === i).length === 1;
        }
        else if (config.email.openInboxOnOne === 2) {
          singleAccount = true;
        }

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
            const buttons = [{
              title: app.l10n('popup_read'),
              iconUrl: '/data/images/read.png',
              callback: () => gmail.action({
                links: tmp.map(o => o.link),
                cmd: 'rd'
              }).catch(() => {}).then(() => window.setTimeout(() => repeater.reset(), 500))
            }, {
              title: app.l10n('popup_archive'),
              iconUrl: '/data/images/archive.png',
              callback: () => gmail.action({
                links: tmp.map(o => o.link),
                cmd: 'rc_^i'
              }).catch(() => {}).then(() => window.setTimeout(() => repeater.reset(), 500))
            }, {
              title: app.l10n('popup_trash'),
              iconUrl: '/data/images/trash.png',
              callback: () => gmail.action({
                links: tmp.map(o => o.link),
                cmd: 'tr'
              }).catch(() => {}).then(() => window.setTimeout(() => repeater.reset(), 500))
            }].filter((o, i) => {
              if (
                (i === 0 && config.notification.buttons.markasread) ||
                (i === 1 && config.notification.buttons.archive) ||
                (i === 2 && config.notification.buttons.trash)
              ) {
                return true;
              }
              return false;
            }).slice(0, 2);
            app.notify(report, '', () => {
              // use open to open the first link and use chrome.tabs.create for the rest
              open(tmp[0].link);
              tmp.slice(1).forEach(o => chrome.tabs.create({
                url: o.link,
                active: false
              }));
            }, buttons);
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
  repeater = new timer.Repeater(
    (config.email.check.first ? config.email.check.first : 5) * 1000,
    config.email.check.period * 1000
  );

  repeater.on(checkEmails.execute);
  if (config.email.check.first === 0) { // manual mode
    repeater.stop();
  }
  // periodic reset
  resetTimer = new timer.Repeater(
    config.email.check.resetPeriod * 1000 * 60,
    config.email.check.resetPeriod * 1000 * 60
  );
  resetTimer.on(actions.reset);
  if (config.email.check.resetPeriod === 0) {
    resetTimer.stop();
  }
});

// updates
app.on('update', () => repeater && repeater.reset());
// messaging
chrome.runtime.onMessage.addListener((request, sender, response) => {
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
  else if (method === 'gmail.action') {
    gmail.action(request).then(e => {
      try {
        response(e);
      }
      catch (e) {
        window.setTimeout(() => repeater.reset(), 500);
      }
    }).catch(e => {
      app.notify(e.message);
      response(e);
    });
    return true;
  }
  else if (method === 'gmail.search') {
    // to prevent errors due to disconnected port
    const callback = a => {
      try {
        response(a);
      }
      catch (e) {}
    };
    gmail.search(request).then(r => callback(r.entries)).catch(() => callback());
    return true;
  }
});

// init
app.on('load', () => {
  const prefs = config.prefs;
  // init;
  toolbar.color = prefs.backgroundColor;
});

{
  const {onInstalled, setUninstallURL, getManifest} = chrome.runtime;
  const {name, version} = getManifest();
  const page = getManifest().homepage_url;
  onInstalled.addListener(({reason, previousVersion}) => {
    chrome.storage.local.get({
      'faqs': true,
      'last-update': 0
    }, prefs => {
      if (reason === 'install' || (prefs.faqs && reason === 'update')) {
        const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
        if (doUpdate && previousVersion !== version) {
          chrome.tabs.create({
            url: page + '?version=' + version +
              (previousVersion ? '&p=' + previousVersion : '') +
              '&type=' + reason,
            active: reason === 'install'
          });
          chrome.storage.local.set({'last-update': Date.now()});
        }
      }
    });
  });
  setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
}
