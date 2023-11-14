/* global button, context, gmail, Feed, repeater, sound */

self.importScripts('/core/utils/feed.js');

{
  let color = 'blue';
  const emails = [];
  const isPrivate = false;

  const read = (prefs, type = 'local') => new Promise(resolve => chrome.storage[type].get(prefs, resolve));

  const notify = async (text, title, click = {}, buttons = []) => {
    title = title || chrome.i18n.getMessage('gmail');

    const p2 = await read({
      'silent': false
    }, 'session');
    if (p2.silent) {
      console.log('notification is silent', text, title);
      return;
    }
    const p1 = await read({
      'notificationTime': 8 // seconds
    }, 'local');
    let isArray = Array.isArray(text);
    if (isArray && text.length === 1) {
      isArray = false;
      text = text[0];
    }
    const when = Date.now() + p1.notificationTime * 1000;
    const options = {
      type: isArray ? 'list' : 'basic',
      iconUrl: '/data/icons/notification/48.png',
      title,
      message: isArray ? '' : text,
      priority: 2,
      eventTime: when,
      items: isArray ? text.map(message => {
        const tmp = message.split('\n');
        return {
          title: (tmp[1] || '').replace('Title: ', ''),
          message: tmp[0].replace('From: ', '')
        };
      }) : [],
      isClickable: click ? true : false,
      requireInteraction: click ? true : false,
      buttons: buttons.map(b => ({
        title: b.title,
        iconUrl: b.iconUrl
      }))
    };
    if (navigator.userAgent.includes('Firefox')) {
      delete options.requireInteraction;
      delete options.buttons;
    }
    // if (config.notification.actions === false) {
    //   delete options.buttons;
    // }

    const id = JSON.stringify({
      id: Math.random(),
      buttons: (options.buttons || []).map(o => o.action),
      click
    });

    chrome.alarms.create('clear.notification.' + id, {
      when
    });
    chrome.notifications.create(id, options);
  };

  const shorten = (str, truncate) => {
    if (str.length < truncate) {
      return str;
    }
    return str.substr(0, truncate / 2) + '...' + str.substr(str.length - truncate / 2);
  };

  const attach = () => chrome.action.setPopup({
    popup: '/data/popup/index.html'
  });
  const detach = () => {
    chrome.action.setPopup({
      popup: ''
    });
    chrome.runtime.sendMessage({
      method: 'close-popup'
    }, () => chrome.runtime.lastError);
  };
  chrome.storage.onChanged.addListener(ps => {
    if (ps.oldFashion) {
      self.checkEmails.getCached().then(objs => {
        const numberOfAccounts = objs.map(o => o.xml ? o.xml.title : null)
          .filter((o, i, a) => o && a.indexOf(o) === i).length;
        const hasUnread = objs.map(o => o.xml ? o.xml.fullcount : 0)
          .reduce((p, c) => p + c, 0);

        if (numberOfAccounts === 1 && ps.oldFashion.newValue === 1) {
          detach();
        }
        else if (hasUnread) {
          attach();
        }
      });
    }
  });

  const buildFeeds = prefs => {
    const tmp = ['0', '1', '2', '3', '4', '5']
      .map(i => prefs['feeds_' + i])
      .map((f, i) => f.split(', ').map(tag => tag ? (tag.startsWith('http:') ? tag : i + '/feed/atom/' + encodeURIComponent(tag)) : ''));
    let merged = [];
    tmp.forEach(l => merged.push(...l));
    merged = merged
      .filter(s => s)
      .map(tag => tag.startsWith('http:') ? tag : 'https://mail.google.com/mail/u/' + tag);

    if (prefs.feeds_custom) {
      merged = [
        ...merged,
        ...prefs.feeds_custom.split(/\s*,\s*/g)
      ];
    }
    merged = merged
      // only feeds without '/inbox' show the right full-count
      .map(tag => tag.replace('/inbox', ''))
      .filter(f => f)
      .filter((feed, index, feeds) => feeds.indexOf(feed) === index)
      .sort();
    if (!merged.length) {
      merged = [
        'https://mail.google.com/mail/u/0/feed/atom',
        'https://mail.google.com/mail/u/1/feed/atom',
        'https://mail.google.com/mail/u/2/feed/atom',
        'https://mail.google.com/mail/u/3/feed/atom'
      ];
    }
    return merged;
  };

  self.checkEmails = {
    getCached() {
      if (self.checkEmails.cached) {
        return Promise.resolve(self.checkEmails.cached);
      }
      return read({
        'cached-objects': []
      }, 'session').then(prefs => prefs['cached-objects']);
    }
  };
  self.checkEmails.execute = async forced => {
    if (forced) {
      button.icon = 'load';
      button.badge = 0;

      color = 'load';
    }
    // Cancel previous execution?
    if (emails.length) {
      emails.forEach(e => e.reject());
    }
    const prefs = await read({
      'url': 'https://mail.google.com/mail/u/0',
      'feeds_0': '',
      'feeds_1': '',
      'feeds_2': '',
      'feeds_3': '',
      'feeds_4': '',
      'feeds_5': '',
      'feeds_custom': '',
      'timeout': 9000,
      'alphabetic': false,
      'notificationTruncate': 70,
      'maxReport': 3,
      'oldFashion': 0,
      'notification': true,
      'notification.buttons.markasread': true,
      'notification.buttons.archive': true,
      'notification.buttons.trash': false,
      'alert': true
    });
    const controller = new AbortController();
    const signal = controller.signal;

    const feeds = buildFeeds(prefs).map(feed => new Feed(feed, prefs.timeout, isPrivate));
    try {
      const responses = await Promise.all(feeds.map(s => s.execute(signal).catch(e => {
        console.log('feed error', e);
      })));
      let objs = responses.filter(o => o);

      console.log('feed results', forced, objs);

      const tmp = objs
        .map(o => (o.notAuthorized === true || o.network === false) ? null : (o.xml ? (o.xml.title + '/' + o.xml.label) : null))
        .map((l, i, a) => !l ? false : a.indexOf(l) !== i);
      tmp.forEach((v, i) => {
        if (!v) {
          return;
        }
        objs[i].notAuthorized = true;
        objs[i].xml = null;
        objs[i].newIDs = [];
      });
      const isAuthorized = objs.some(c => !c.notAuthorized && c.network);
      if (!isAuthorized) {
        if (color !== 'blue') {
          button.icon = 'blue';
          button.badge = 0;
          color = 'blue';
          chrome.storage.session.set({count: -1});
          chrome.storage.session.set({
            'cached-objects': []
          });
          self.checkEmails.cached.length = 0;
          context.accounts();
        }
        if (forced) {
          self.openLink(prefs.url);
          notify(chrome.i18n.getMessage('log_into_your_account'));
        }
        button.label = chrome.i18n.getMessage('gmail');
        detach();

        console.log('ignore checking', 'unauthorized');
        return;
      }
      // Removing not logged-in accounts
      objs = objs.filter(function(o) {
        return o.network && !o.notAuthorized && o.xml && o.xml.entries;
      });
      // Sorting accounts
      objs.sort((a, b) => {
        const var1 = prefs.alphabetic ? a.xml.title : a.xml.link;
        const var2 = prefs.alphabetic ? b.xml.title : b.xml.link;
        if (var1 > var2) {
          return 1;
        }
        if (var1 < var2) {
          return -1;
        }
        return 0;
      });
      // Update cache
      chrome.storage.session.set({
        'cached-objects': objs
      });
      self.checkEmails.cached = objs;

      const count = await new Promise(resolve => chrome.storage.session.get({
        count: -1
      }, prefs => resolve(prefs.count)));

      // New total count number
      const anyNewEmails = objs.some(c => c.newIDs.length !== 0);
      let newCount = 0;
      for (const obj of objs) {
        newCount += obj.xml.fullcount;
      }
      if (!anyNewEmails && !forced && count === newCount) {
        // Updating panel if it is open
        chrome.runtime.sendMessage({
          method: 'update-date',
          data: objs
        }, () => {
          if (chrome.runtime.lastError) {
            return;
          }
          // maybe the current email is marked as read but still count is 20 (max value for non inbox labels)
          chrome.runtime.sendMessage({
            method: 'validate-current',
            data: objs
          });
        });
        return; // Everything is clear
      }
      //
      chrome.storage.session.set({count: newCount});
      //
      context.accounts();
      // Preparing the report
      const reportArray = [];
      for (const o of objs) {
        (o.xml && o.xml.entries ? o.xml.entries : []).filter(e => {
          if (anyNewEmails) {
            return o.newIDs.includes(e.id) === false;
          }
          return o.xml.fullcount !== 0;
        }).splice(0, prefs.maxReport).forEach(e => {
          e.parent = o;
          reportArray.push(e);
        });
      }
      const format = chrome.i18n.getMessage('notification');
      let report = reportArray.map(e => format
        .replace('[author_name]', e.author_name)
        .replace('[author_email]', e.author_email)
        .replace('[summary]', shorten(e.summary, prefs.notificationTruncate))
        .replace('[title]', shorten(e.title, prefs.notificationTruncate))
        .replace(/\[break\]/g, '\n'));
      if (navigator.userAgent.includes('Firefox')) {
        report = [report.join('\n\n')];
      }
      // Preparing the tooltip
      button.label = chrome.i18n.getMessage('gmail') + '\n\n' +
        objs.reduce((p, c) => {
          return p +=
            c.xml.title +
            (c.xml.label ? ' [' + c.xml.label + ']' : '') +
            ' (' + c.xml.fullcount + ')\n';
        }, '').replace(/\n$/, '');

      const singleAccount = prefs.oldFashion === 1 ?
        objs.map(o => o.xml.rootLink).filter((s, i, l) => l.indexOf(s) === i).length === 1 :
        prefs.oldFashion === 2;
      //
      if (!forced && !anyNewEmails) {
        if (newCount) {
          button.icon = 'red';
          button.badge = newCount;
          color = 'red';

          chrome.runtime.sendMessage({
            method: 'update',
            data: objs
          }, () => chrome.runtime.lastError);
          if (singleAccount) {
            detach();
          }
          else {
            attach();
          }
        }
        else {
          button.icon = 'gray';
          button.badge = 0;
          color = 'gray';
          detach();
        }
      }
      else if (forced && !newCount) {
        button.icon = 'gray';
        button.badge = 0;
        color = 'gray';
        detach();
      }
      else {
        button.icon = 'new';
        button.badge = newCount;
        color = 'new';
        if (singleAccount) {
          detach();
        }
        else {
          attach();
        }
        if (prefs.notification) {
          const buttons = [];
          if (prefs['notification.buttons.markasread']) {
            buttons.push({
              title: chrome.i18n.getMessage('popup_read'),
              iconUrl: '/data/images/read.png',
              action: {
                links: tmp.map(o => o.link),
                cmd: 'rd'
              }
            });
          }
          if (prefs['notification.buttons.archive']) {
            buttons.push({
              title: chrome.i18n.getMessage('popup_archive'),
              iconUrl: '/data/images/archive.png',
              action: {
                links: tmp.map(o => o.link),
                cmd: 'rc_^i'
              }
            });
          }
          if (prefs['notification.buttons.trash']) {
            buttons.push({
              title: chrome.i18n.getMessage('popup_trash'),
              iconUrl: '/data/images/trash.png',
              action: {
                links: tmp.map(o => o.link),
                cmd: 'tr'
              }
            });
          }

          // convert links
          const links = [];
          for (const o of tmp) {
            try {
              const base = gmail.get.base(o.link);
              const messageID = gmail.get.id(o.link);

              if (messageID && o.parent.xml.link.indexOf('#') === -1) {
                links.push(base + '/?shva=1#inbox/' + messageID);
              }
              else if (messageID) {
                links.push(o.parent.xml.link + '/' + messageID);
              }
              else {
                links.push(o.link);
              }
            }
            catch (e) {
              links.push(o.link);
            }
          }

          notify(report, '', {
            cmd: 'open',
            links
          }, buttons.slice(0, 2));
        }
        if (prefs.alert) {
          sound.play(tmp);
        }
        chrome.runtime.sendMessage({
          method: 'update-reset',
          data: objs
        }, () => chrome.runtime.lastError);
      }
    }
    catch (e) {
      console.error(e);
    }
  };
}

chrome.notifications.onClicked.addListener(id => {
  chrome.notifications.clear(id);
  sound.stop();
  if (id.startsWith('{')) {
    const j = JSON.parse(id);
    if (j.click && j.click.cmd === 'open') {
      const {links} = j.click;
      // use open to open the first link and use chrome.tabs.create for the rest
      self.openLink(links[0]);
      links.slice(1).forEach(url => chrome.tabs.create({
        url,
        active: false
      }));
    }
  }
});
if (chrome.notifications.onButtonClicked) {
  chrome.notifications.onButtonClicked.addListener((id, index) => {
    sound.stop();

    const j = JSON.parse(id);
    const command = j.buttons[index];
    gmail.action(command).catch(e => {
      console.error(e);
    }).finally(() => repeater.reset('action.command', 500));

    chrome.notifications.clear(id);
  });
}

chrome.alarms.onAlarm.addListener(o => {
  if (o.name.startsWith('clear.notification.')) {
    const id = o.name.slice(19);
    chrome.notifications.clear(id);
  }
});
