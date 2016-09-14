'use strict';

var isFirefox = typeof require !== 'undefined',
    isSafari  = typeof safari !== 'undefined';

if (isFirefox) {
  var app = require('./wrapper/firefox/app');
  var config = require('./config');
  var timer = require('./utils/timer');
  var server = require('./utils/server');
  var gmail = require('./utils/gmail');
  var tab = require('./utils/tab');
}

// add a repeater to check all accounts
var repeater = new timer.repeater(
  (config.email.check.first ? config.email.check.first : 5) * 1000,
  config.email.check.period * 1000
);

var actions = {
  silent: function (time) {
    app.timer.clearTimeout(config.notification.silent);
    config.notification.silent = false;
    if (time === 'custom') {
      time = config.notification.silentTime * 60;
    }
    if (!isNaN(time)) {
      config.notification.silent = app.timer.setTimeout(function () {
        config.notification.silent = false;
      }, time * 1000);
    }
  },
  reset: function () {
    repeater.reset(true);
  },
  openOptions: function () {
    open(app.manifest.url + 'data/options/index.html', false, true);
  },
  onCommand: function (link) {
    var hasUnread = checkEmails.getCached()
      .map(function (o) {
        return o.xml ? o.xml.fullcount : 0;
      })
      .reduce(function (p, c) {
        return p + c;
      }, 0);
    var numberOfAccounts = checkEmails.getCached()
      .map(function (o) {
        return o.xml ? o.xml.title : null;
      })
      .filter(function (o, i, a) {
        return o && a.indexOf(o) === i;
      })
      .length;
    if (isFirefox) {
      if (!hasUnread || (config.email.openInboxOnOne === 1 && numberOfAccounts === 1)) {
        open(config.email.url);
      }
      else {
        app.popup.show();
      }
    }
    else {
      open(link || config.email.url);
    }
  }
};
app.on('open-options', actions.openOptions);
if (isFirefox) {
  app.connect(actions);
}

var icon = (function () {
  var i = 0, t = [];

  function clearTimeout () {
    t.forEach(function (_t) {
      app.timer.clearTimeout(_t);
      t.splice(t.indexOf(_t), 1);
    });
  }

  return function (clr) {
    function set (clr) {
      // Change color pattern?
      if (config.ui.pattern === 1) {
        switch (clr) {
          case 'blue':
            clr = 'gray';
            break;
          case 'gray':
            clr = 'blue';
            break;
        }
      }
      if (config.ui.pattern === 2) {
        switch (clr) {
          case 'blue':
            clr = 'gray';
            break;
          case 'red':
            clr = 'blue';
            break;
          case 'gray':
            clr = 'red';
            break;
        }
      }
      app.button.color = clr;
    }

    clearTimeout();
    if (clr === 'load') {
      t.push(app.timer.setTimeout(function () {
        set('load' + i);
        i += 1;
        i = i % 4;
        icon('load');
      }, 200));
    }
    else if (clr === 'new') {
      t.push(app.timer.setTimeout(function () {
        set(i % 2 ? 'red' : 'new');
        if (i < 7) {
          i += 1;
          icon('new');
        }
        else {
          i = 0;
        }
      }, 300));
    }
    else {
      i = 0;
      set(clr);
    }
  };
})();

function play (arr) {
  var filters = [0, 1, 2, 3, 4].map(function (index) {
    return {
      filter: config.notification.sound.media['custom' + index].filter,
      selector: config.notification.sound.media['custom' + index].selector,
      index: index
    };
  }).
  filter(function (obj) {
    return obj.filter;
  }).
  filter(function (obj) {
    if (obj.selector === 0) {
      return arr.reduce(function (p, c) {
        return p || (
          c.author_email.toLowerCase().indexOf(obj.filter.toLowerCase()) !== -1 ||
          c.author_name.toLowerCase().indexOf(obj.filter.toLowerCase()) !== -1
        );
      }, false);
    }
    if (obj.selector === 1) {
      return arr.reduce(function (p, c) {
        return p || c.title.toLowerCase().indexOf(obj.filter.toLowerCase()) !== -1;
      }, false);
    }
    if (obj.selector === 2) {
      return arr.reduce(function (p, c) {
        return p || c.summary.toLowerCase().indexOf(obj.filter.toLowerCase()) !== -1;
      }, false);
    }
    return false;
  });
  app.play(filters.length ? filters[0].index : null);
}

function open (url, inBackground, refresh) {
  function parseUri (str) {
    str = str || '';
    str = str.replace('gmail', 'mail.google');
    var o = {
      strictMode: false,
      key: ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'],
      q:   {
        name:   'queryKey',
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
      },
      parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
      }
    };
    var m = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str),
      uri = {},
      i   = 14;

    while (i--) {
      uri[o.key[i]] = m[i] || '';
    }

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
      if ($1) {
        uri[o.q.name][$1] = $2;
      }
    });
    uri.base = uri.host.split('&')[0];

    if (uri.host.indexOf('mail.google') !== -1) {
      uri.message_id = (/message_id\=([^&]*)|\#[^\/]*\/([^&]*)/.exec(uri.host) || [])[1] || uri.anchor.split('/')[1];
      uri.label = (/\#([^\/]*)/.exec(uri.source) || [])[1];
    }

    return uri;
  }

  app.windows.active()
    .then(function () {
      if (config.tabs.ignoreOpens) {
        return [];
      }
      var tabs = [];
      try { // http://add0n.com/gmail-notifier.html#comment-2622018574
        tabs = app.windows.tabs.list(config.tabs.search);
      }
      catch (e) {}
      return tabs;
    })
    .then(function (tabs) {
      var parse2 = parseUri(url);

      for (var i = 0; tab = tabs[i], i < tabs.length; i++) {
        if (tab.url === url) {
          if (config.tabs.NotifyGmailIsOpen && tab.active) {
            app.notify(app.l10n('msg_1'));
          }
          tab.activate();
          // Focus the tab container
          tab.window().then(function (win) {
            win.focus();
          });

          if (refresh) {
            tab.url = url;
          }
          return;
        }
        var parse1 = parseUri(tab.url);
        // Only if Gmail
        if (
          parse1.base.indexOf('mail.google') !== -1 &&
          parse1.base === parse2.base &&
          parse1.directory.indexOf(parse2.directory) === 0 &&
          !/to\=/.test(url) &&
          !/view\=cm/.test(url)
        ) {
          var reload = parse2.message_id && tab.url.indexOf(parse2.message_id) === -1 || refresh;
          if (tab.active && !reload) {
            if (config.tabs.NotifyGmailIsOpen) {
              app.notify(app.l10n('msg_1'));
            }
          }
          else if (tab.active && reload) {
            tab.url = url;
          }
          if (!tab.active) {
            tab.activate();
            // Focus not active window
            tab.window().then(function (win) {
              win.focus();
            });
            if (reload) {
              tab.url = url;
            }
          }
          return;
        }
      }
      if (config.tabs.open.mode === 2) {
        app.windows.tabs.active().then(function (tab) {
          tab.url = url;
        });
      }
      else if (config.tabs.open.mode === 0) {
        app.windows.tabs.open(url, typeof inBackground !== 'undefined' ? inBackground : config.tabs.open.background);
      }
      else {
        app.windows.open(url, typeof inBackground !== 'undefined' ? inBackground : config.tabs.open.background);
      }
    });
}

function setBadge (val) {
  if (val > 999 && config.ui.minimal) {
    val = '>' + Math.round(val / 1000) + 'K';
  }
  app.button.badge = val === 0 ? '' : val + '';
}
var checkEmails = (function () {
  var color = 'blue', count = -1, cachedEmails;
  var emails, feeds = '';

  return {
    execute: function (forced) {
      if (forced) {
        icon('load');
        setBadge(0);
        color = 'load';
      }
      // Cancel previous execution?
      if (emails && emails.length) {
        emails.forEach(function (e) {
          e.reject();
        });
      }
      if (config.email.feeds.join(', ') !== feeds) {
        emails = config.email.feeds.map(function (feed) {
          return new server.Email(feed, config.email.timeout);
        });
        feeds = config.email.feeds.join(', ');
      }
      // Execute fresh servers
      app.Promise.all(emails.map(function (e) {
        return e.execute().catch (function () {});
      })).then(function (objs) {
        // Removing error objects
        objs = objs.filter(function (o) {
          return o;
        });
        // Make sure there is no duplicate account
        var tmp = objs.map(function (o) {
          return o.notAuthorized === true || o.network === false ? null : (o.xml ? o.xml.title + '/' + o.xml.label : null);
        })
        .map(function (l, i, a) {
          return !l ? false : a.indexOf(l) !== i;
        });
        tmp.forEach(function (v, i) {
          if (!v) {
            return;
          }
          objs[i].notAuthorized = true;
          objs[i].xml = null;
          objs[i].newIDs = [];
        });

        var isAuthorized = objs.reduce(function (p, c) {
          return p || (!c.notAuthorized && c.network);
        }, false);
        var anyNewEmails = objs.reduce(function (p, c) {
          return p || (c.newIDs.length !== 0);
        }, false);
        if (!isAuthorized) {
          if (color !== 'blue') {
            icon('blue');
            setBadge(0);
            color = 'blue';
            count = -1;
            cachedEmails = [];
            app.button.fireContext();
            app.popup.detach();
          }
          if (forced) {
            open(config.email.url);
            app.notify(app.l10n('log_into_your_account'));
          }
          if (config.tray.permanent && config.tray.show) {
            app.tray.set(-1, config.labels.tooltip);
          }
          else {
            app.tray.remove();
          }
          app.button.label = config.labels.tooltip;
          app.popup.detach();
          return;
        }
        //Removing not logged-in accounts
        objs = objs.filter(function (o) {
          return o.network && !o.notAuthorized && o.xml;
        });
        //Sorting accounts
        objs.sort(function (a, b) {
          var var1 = config.email.alphabetic ? a.xml.title : a.xml.link,
              var2 = config.email.alphabetic ? b.xml.title : b.xml.link;
          if (var1 > var2) {
            return 1;
          }
          if (var1 < var2) {
            return -1;
          }
          return 0;
        });
        // New total count number
        var newCount = objs.reduce(function (p, c) {
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
        app.button.fireContext();
        // Preparing the report
        var tmp = [];
        objs.forEach (function (o) {
          (o.xml ? o.xml.entries : [])
            .filter(function (e) {
              return anyNewEmails ? o.newIDs.indexOf(e.id) !== -1 : o.xml.fullcount !== 0;
            })
            .splice(0, config.email.maxReport)
            .forEach(function (e) {
              tmp.push(e);
            });
        });
        function shorten (str) {
          if (str.length < config.email.truncate) {
            return str;
          }
          return str.substr(0, config.email.truncate / 2) + '...' + str.substr(str.length - config.email.truncate / 2);
        }
        var report = tmp.map(function (e) {
          return config.notification.format
            .replace('[author_name]', e.author_name)
            .replace('[author_email]', e.author_email)
            .replace('[summary]', shorten(e.summary))
            .replace('[title]', shorten(e.title))
            .replace(/\[break\]/g, '\n');
        });
        if (config.notification.combined) {
          report = [report.join('\n\n')];
        }
        // Preparing the tooltip
        var tooltip =
          app.l10n('gmail') + '\n\n' +
          objs.reduce(function (p, c) {
            return p +=
              c.xml.title +
              (c.xml.label ? ' [' + c.xml.label + ']' : '') +
              ' (' + c.xml.fullcount + ')' + '\n';
          }, '').replace(/\n$/, '');
        // Preparing tray tooltip; make sure length is less than 64 chars
        var trayTooltip = (function () {
          var name = objs.reduce(function (p, c) {
            return p +=
              c.xml.title +
              (c.xml.label ? ' [' + c.xml.label + ']' : '') +
              ' (' + c.xml.fullcount + ')' + '\n';
          }, '').replace(/\n$/, '');

          var title = app.l10n('gmail') + '\n\n';
          if (name.length + title.length < 64) {
            name = title + name;
          }
          if (name.length > 64) {
            name = name.replace(/\@.* \(/g , ' (');
          }
          return name;
        })();

        if (!forced && !anyNewEmails) {
          if (newCount) {
            icon('red');
            setBadge(newCount);
            color = 'red';
            if (config.tray.show) {
              app.tray.set(newCount, trayTooltip);
            }
            app.button.label = tooltip;
            app.popup.send('update', objs);
            if (tmp.length === 1 && config.email.openInboxOnOne === 1) {
              app.popup.detach();
            }
            else {
              app.popup.attach();
            }
          }
          else {
            icon('gray');
            setBadge(0);
            color = 'gray';
            if (config.tray.permanent && config.tray.show) {
              app.tray.set(0, config.labels.tooltip);
            }
            else {
              app.tray.remove();
            }
            app.button.label = tooltip;
            app.popup.detach();
          }
        }
        else if (forced && !newCount) {
          icon('gray');
          setBadge(0);
          color = 'gray';
          if (config.tray.permanent && config.tray.show) {
            app.tray.set(0, config.labels.tooltip);
          }
          else {
            app.tray.remove();
          }
          app.button.label = tooltip;
          app.popup.detach();
        }
        else {
          icon('new');
          setBadge(newCount);
          color = 'new';
          if (tmp.length === 1 && config.email.openInboxOnOne === 1) {
            app.popup.detach();
          }
          else {
            app.popup.attach();
          }
          if (config.notification.show) {
            app.notify(report, '', function () {
              app.timer.setTimeout(function () {
                // restore browser window first!
                app.windows.active().then(function (win) {
                  win.focus();
                  app.timer.setTimeout(actions.onCommand, 1000, tmp.length ? tmp[0].link : null);
                });
              }, 100);
            });
          }
          if (config.tray.show) {
            app.tray.set(newCount, trayTooltip);
          }
          if (config.notification.sound.play) {
            play(tmp);
          }
          app.button.label = tooltip;
          app.popup.send('update-reset', objs);
        }
      }, function () {
        // this should not be called
      });
    },
    getCached: function () {
      return cachedEmails || [];
    }
  };
})();
repeater.on(checkEmails.execute);
if (!config.email.check.first) {  // manual mode
  repeater.stop();
}
// On safari to prevent multiple authentication popups, the repeater is disabled until the first account is logged-in
if (isSafari && config.email.check.first) {
  var isLoggedin = (function () {
    return function () {
      app.get('https://mail.google.com/mail/u/0/feed/atom').then(function (req) {
        if (req.status === 200) {
          repeater.reset();
          if (config.notification.safari.oneTime) {
            window.alert(app.l10n('msg_4'));
            open('https://mail.google.com/mail/u/0/#inbox');
            config.notification.safari.oneTime = false;
          }
        }
        else {
          app.timer.setTimeout(isLoggedin, 60000);
        }
      });
    };
  })();
  repeater.stop();
  isLoggedin();
}
// periodic reset
var resetTimer = new timer.repeater(
  config.email.check.resetPeriod * 1000 * 60,
  config.email.check.resetPeriod * 1000 * 60
);
resetTimer.on(actions.reset);
if (!config.email.check.resetPeriod) {
  resetTimer.stop();
}

//popup
function doPopupResize () {
  app.popup.send('resize', {
    width: config.popup.width,
    height: config.popup.height,
    mode: config.popup.mode
  });
}
app.popup.receive('resize', doPopupResize);
app.popup.receive('mode', function (mode) {
  config.popup.mode = mode;
  doPopupResize ();
});
app.popup.receive('show', function () {
  var objs = checkEmails.getCached();
  if (objs.length) {
    app.popup.send('update-reset', objs);
  }
});
app.popup.receive('open', function (link) {
  app.popup.hide();
  if (link) {
    open(link);
  }
});
app.popup.receive('clipboard', function (o) {
  app.clipboard(o.str);
  app.notify(app.l10n(o.type ? 'msg_3' : 'msg_2'));
});
app.popup.receive('update', function () {
  repeater.reset(true);
});
app.popup.receive('action', function (o) {
  gmail.action(o.links, o.cmd).then(
    function () {
      app.popup.send('action-response', o.cmd);
    },
    function (e) {
      app.notify(e);
    }
  );
});
app.popup.receive('body', function (link) {
  gmail.body(link).then(function (content) {
    app.popup.send('body-response', {
      link: link,
      content: content
    });
  });
});
app.popup.receive('keyUp', function () {
  app.popup.send('keyUp', config.popup.keyUp);
});
app.popup.receive('options', function () {
  actions.openOptions();
  app.popup.hide();
});

// user interactions
app.button.onCommand(actions.onCommand);
app.button.onClick (function (e) {
  if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
    e.preventDefault();
    e.stopPropagation();
    if (config.toolbar.clicks.middle === 0) {
      actions.reset();
    }
    else {
      open(config.email.url);
    }
  }
});

app.button.onContext({
  get accounts () {
    var show = checkEmails.getCached().map(function (o) {
      return o.xml ? o.xml.rootLink : null;
    })
    .filter(function (o) {
      return o;
    })
    .map(function (e, i, a) {
      return a.indexOf(e) === i;
    });
    return checkEmails.getCached().filter(function (e, i) {
      return show[i];
    }).map(function (o) {
      return {
        label: o.xml.title,
        command: function (link) {
          if (link) {
            open(link.replace(/\?.*/ , ''));
          }
        }.bind(this, o.xml.rootLink)
      };
    });
  },
  silent: actions.silent,
  faq: function () {
    open(config.welcome.homepage + '?type=context');
  },
  refresh: actions.reset,
  compose: function () {
    open(config.email.compose);
  },
  options: actions.openOptions,
  get state () {
    return !config.notification.silent;
  }
});

// initialization
app.startup(function () {
  //welcome
  if (app.version() !== config.welcome.version) {
    if (config.welcome.notification) {
      var url = config.welcome.homepage +
        '?type=' + (config.welcome.version ? 'upgrade' : 'install') +
        (config.welcome.version ? '&p=' + config.welcome.version : '') +
        '&v=' + app.version();
      app.timer.setTimeout(function () {
        open(url, false);
      }, config.welcome.time);
    }
    config.welcome.version = app.version();
  }
});
if (!config.welcome.version) {
  config.email.feeds_0 =
  config.email.feeds_1 =
  config.email.feeds_2 =
  config.email.feeds_3 =
  config.email.feeds_4 =
  config.email.feeds_5 = 'inbox';
}

//tray notification
app.tray.callback(function () {
  app.windows.active().then(function (win) {
    win.focus();
    app.timer.setTimeout(actions.onCommand, 100);
  });
});
//options
app.options.receive('changed', function (o) {
  config.set(o.pref, o.value);
  app.options.send('set', {
    pref: o.pref,
    value: config.get(o.pref)
  });
});
app.options.receive('get', function (pref) {
  app.options.send('set', {
    pref: pref,
    value: config.get(pref)
  });
});
// pref listeners
config.on('email.check.resetPeriod', function () {
  if (config.email.check.resetPeriod) {
    resetTimer.fill(config.email.check.resetPeriod * 1000 * 60);
    resetTimer.reset();
  }
  else {
    resetTimer.stop();
  }
});
config.on('email.check.period', function () {
  repeater.fill(config.email.check.period * 1000);
});
config.on('email.openInboxOnOne', function () {
  var numberOfAccounts = checkEmails.getCached()
    .map(function (o) {
      return o.xml ? o.xml.title : null;
    })
    .filter(function (o, i, a) {
      return o && a.indexOf(o) === i;
    })
    .length;
  var hasUnread = checkEmails.getCached()
    .map(function (o) {
      return o.xml ? o.xml.fullcount : 0;
    })
    .reduce(function (p, c) {
      return p + c;
    }, 0);
  if (numberOfAccounts === 1 && config.email.openInboxOnOne === 1) {
    app.popup.detach();
  }
  else if (hasUnread) {
    app.popup.attach();
  }
});
config.on('keyUp', function () {
  app.popup.send('keyUp', config.popup.keyUp);
});
config.on('ui.pattern', actions.reset);
config.on('ui.minimal', actions.reset);
config.on('tray.show', function () {
  if (config.tray.show) {
    actions.reset();
  }
  else {
    app.tray.remove();
  }
});
// update
app.on('update', function () {
  app.timer.setTimeout(function () {
    repeater.reset();
  }, 500);
})
