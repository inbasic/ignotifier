/* globals app, config, contextmenu */
'use strict';

Object.assign(config.prefs, {
  'timeout': 9000,
  'maxReport': 3,
  'tooltip': true,
  'firstRun': true,
  'version': null,
  'notification.sound.media.default.file': null,
  'notification.sound.media.custom0.file': null,
  'notification.sound.media.custom1.file': null,
  'notification.sound.media.custom2.file': null,
  'notification.sound.media.custom3.file': null,
  'notification.sound.media.custom4.file': null
});

chrome.storage.onChanged.addListener(prefs => {
  Object.keys(prefs).forEach(key => config.prefs[key] = prefs[key].newValue);
});

config.email = {
  url: 'https://mail.google.com/mail/u/0',
  get basic() {
    return config.prefs['basic.html'];
  },
  compose: 'https://mail.google.com/mail/?ui=2&view=cm',
  get feeds_0() {
    return config.prefs['feeds_0'];
  },
  get feeds_1() {
    return config.prefs['feeds_1'];
  },
  get feeds_2() {
    return config.prefs['feeds_2'];
  },
  get feeds_3() {
    return config.prefs['feeds_3'];
  },
  get feeds_4() {
    return config.prefs['feeds_4'];
  },
  get feeds_5() {
    return config.prefs['feeds_5'];
  },
  get feeds_custom() {
    return config.prefs['feeds_custom'];
  },
  get feeds() {
    var tmp = ['0', '1', '2', '3', '4', '5']
      .map(i => config.email['feeds_' + i])
      .map((f, i) => f.split(', ').map(tag => tag ? (tag.startsWith('http:') ? tag : i + '/feed/atom/' + encodeURIComponent(tag)) : ''));
    let merged = [];
    tmp.forEach(l => merged.push(...l));
    merged = merged
      .filter(s => s)
      .map(tag => tag.startsWith('http:') ? tag : 'https://mail.google.com/mail/u/' + tag);

    if (config.email.feeds_custom) {
      merged = [
        ...merged,
        ...config.email.feeds_custom.split(/\s*,\s*/g)
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
  },
  get timeout() {
    return config.prefs.timeout;
  },
  get maxReport() { // Maximum number of simultaneous reports from a single account
    return config.prefs.maxReport;
  },
  get threatAsNew() { // in minutes
    return config.prefs.threatAsNew;
  },
  get truncate() {
    return config.prefs.notificationTruncate;
  },
  get alphabetic() {
    return config.prefs.alphabetic;
  },
  get doReadOnArchive() {
    return config.prefs.doReadOnArchive;
  },
  get inboxRedirection() {
    return config.prefs.inboxRedirection;
  },
  get openInboxOnOne() {
    return config.prefs.oldFashion;
  },
  check: {
    get first() {
      return config.prefs.initialPeriod;
    },
    get period() {
      return config.prefs.period;
    },
    get resetPeriod() {
      return config.prefs.resetPeriod;
    }
  }
};

config.notification = {
  get show() {
    return config.prefs.notification;
  },
  get combined() {
    return config.prefs.combined;
  },
  sound: {
    get play() {
      return config.prefs.alert;
    },
    get volume() {
      return config.prefs.soundVolume;
    },
    media: {
      default: {
        get type() { // 0-3: built-in, 4: user defined
          return config.prefs['notification.sound.media.default.type'];
        },
        get file() {
          return config.prefs['notification.sound.media.default.file'];
        },
        get mime() {
          return config.prefs['notification.sound.media.default.mime'];
        }
      },
      custom0: {
        get type() { // 0-3: built-in, 4: user defined
          return config.prefs['notification.sound.media.custom0.type'];
        },
        get file() {
          return config.prefs['notification.sound.media.custom0.file'];
        },
        get mime() {
          return config.prefs['notification.sound.media.custom0.mime'];
        },
        get filter() {
          return config.prefs['notification.sound.media.custom0.filter'];
        },
        get selector() {
          return config.prefs['notification.sound.media.custom0.selector'];
        }
      },
      custom1: {
        get type() { // 0-3: built-in, 4: user defined
          return config.prefs['notification.sound.media.custom1.type'];
        },
        get file() {
          return config.prefs['notification.sound.media.custom1.file'];
        },
        get mime() {
          return config.prefs['notification.sound.media.custom1.mime'];
        },
        get filter() {
          return config.prefs['notification.sound.media.custom1.filter'];
        },
        get selector() {
          return config.prefs['notification.sound.media.custom1.selector'];
        }
      },
      custom2: {
        get type() { // 0-3: built-in, 4: user defined
          return config.prefs['notification.sound.media.custom2.type'];
        },
        get file() {
          return config.prefs['notification.sound.media.custom2.file'];
        },
        get mime() {
          return config.prefs['notification.sound.media.custom2.mime'];
        },
        get filter() {
          return config.prefs['notification.sound.media.custom2.filter'];
        },
        get selector() {
          return config.prefs['notification.sound.media.custom2.selector'];
        }
      },
      custom3: {
        get type() { // 0-3: built-in, 4: user defined
          return config.prefs['notification.sound.media.custom3.type'];
        },
        get file() {
          return config.prefs['notification.sound.media.custom3.file'];
        },
        get mime() {
          return config.prefs['notification.sound.media.custom3.mime'];
        },
        get filter() {
          return config.prefs['notification.sound.media.custom3.filter'];
        },
        get selector() {
          return config.prefs['notification.sound.media.custom3.selector'];
        }
      },
      custom4: {
        get type() { // 0-3: built-in, 4: user defined
          return config.prefs['notification.sound.media.custom4.type'];
        },
        get file() {
          return config.prefs['notification.sound.media.custom4.file'];
        },
        get mime() {
          return config.prefs['notification.sound.media.custom4.mime'];
        },
        get filter() {
          return config.prefs['notification.sound.media.custom4.filter'];
        },
        get selector() {
          return config.prefs['notification.sound.media.custom4.selector'];
        }
      }
    }
  },
  get format() {
    return config.prefs.notificationFormat;
  },
  get time() {
    return config.prefs.notificationTime;
  },
  get silentTime() {
    return config.prefs.silentTime; // in minutes
  },
  _silent: false,
  get silent() {
    return config.notification._silent;
  },
  set silent(val) {
    window.clearTimeout(config.notification._silent);
    config.notification._silent = val;
    chrome.contextMenus.update(contextmenu.ids.silent, {
      checked: val === false
    });
  },
  buttons: {
    get markasread() {
      return config.prefs['notification.buttons.markasread'];
    },
    get trash() {
      return config.prefs['notification.buttons.trash'];
    },
    get archive() {
      return config.prefs['notification.buttons.archive'];
    }
  }
};

config.labels = {
  get tooltip() {
    return app.l10n('gmail');
  }
};

config.ui = {
  get badge() {
    return config.prefs.badge;
  },
  get tooltip() {
    return config.prefs.tooltip;
  },
  get minimal() {
    return config.prefs.minimal;
  },
  get pattern() { // 0: normal color scheme, 1: reverse color scheme
    return config.prefs.clrPattern;
  },
  get backgroundColor() { // 0: normal color scheme, 1: reverse color scheme
    return config.prefs.backgroundColor;
  }
};

config.tabs = {
  get search() { // true: current window only, false: all open windows
    return config.prefs.searchMode;
  },
  get ignoreOpens() { // true: ignore opened Gmail tabs
    return config.prefs.ignoreOpens;
  },
  get NotifyGmailIsOpen() {
    return config.prefs.onGmailNotification;
  },
  open: {
    get useBlankTabs() {
      return config.prefs.useBlankTabs;
    },
    get background() {
      return config.prefs.background;
    },
    get relatedToCurrent() {
      return config.prefs.relatedToCurrent;
    },
    get _current() {
      return config.prefs.currentTab;
    },
    get _newWindow() {
      return config.prefs.newWindow;
    },
    get mode() { // 0: new tab, 1: new window, 2: current tab
      if (this._current) {
        return 2;
      }
      if (this._newWindow) {
        return 1;
      }
      return 0;
    },
    get smart() {
      return config.prefs['smartOpen'];
    }
  }
};

config['plug-ins'] = {
  get labels() {
    return config.prefs['plug-in/labels'];
  }
};
