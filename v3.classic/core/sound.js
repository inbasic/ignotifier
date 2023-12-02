/* global log, offscreen */

const sound = {};

sound.play = (entries = []) => {
  chrome.storage.session.get({
    silent: false
  }, prefs => {
    if (prefs.silent) {
      log('[play]', 'aborted', 'silent mode');
      return;
    }
    chrome.storage.local.get({
      'notification.sound.media.default.type': 0,
      'notification.sound.media.custom0.type': 0,
      'notification.sound.media.custom1.type': 0,
      'notification.sound.media.custom2.type': 0,
      'notification.sound.media.custom3.type': 0,
      'notification.sound.media.custom4.type': 0,
      'notification.sound.media.custom0.selector': 0,
      'notification.sound.media.custom1.selector': 0,
      'notification.sound.media.custom2.selector': 0,
      'notification.sound.media.custom3.selector': 0,
      'notification.sound.media.custom4.selector': 0,
      'notification.sound.media.custom0.filter': '',
      'notification.sound.media.custom1.filter': '',
      'notification.sound.media.custom2.filter': '',
      'notification.sound.media.custom3.filter': '',
      'notification.sound.media.custom4.filter': '',
      'notification.sound.media.default.file': null,
      'notification.sound.media.custom0.file': null,
      'notification.sound.media.custom1.file': null,
      'notification.sound.media.custom2.file': null,
      'notification.sound.media.custom3.file': null,
      'notification.sound.media.custom4.file': null,
      'alert': true,
      'soundVolume': 80
    }, prefs => {
      const media = {
        default: {
          get type() { // 0-3: built-in, 4: user defined
            return prefs['notification.sound.media.default.type'];
          },
          get file() {
            return prefs['notification.sound.media.default.file'];
          },
          get mime() {
            return prefs['notification.sound.media.default.mime'];
          }
        },
        custom0: {
          get type() { // 0-3: built-in, 4: user defined
            return prefs['notification.sound.media.custom0.type'];
          },
          get file() {
            return prefs['notification.sound.media.custom0.file'];
          },
          get mime() {
            return prefs['notification.sound.media.custom0.mime'];
          },
          get filter() {
            return prefs['notification.sound.media.custom0.filter'];
          },
          get selector() {
            return prefs['notification.sound.media.custom0.selector'];
          }
        },
        custom1: {
          get type() { // 0-3: built-in, 4: user defined
            return prefs['notification.sound.media.custom1.type'];
          },
          get file() {
            return prefs['notification.sound.media.custom1.file'];
          },
          get mime() {
            return prefs['notification.sound.media.custom1.mime'];
          },
          get filter() {
            return prefs['notification.sound.media.custom1.filter'];
          },
          get selector() {
            return prefs['notification.sound.media.custom1.selector'];
          }
        },
        custom2: {
          get type() { // 0-3: built-in, 4: user defined
            return prefs['notification.sound.media.custom2.type'];
          },
          get file() {
            return prefs['notification.sound.media.custom2.file'];
          },
          get mime() {
            return prefs['notification.sound.media.custom2.mime'];
          },
          get filter() {
            return prefs['notification.sound.media.custom2.filter'];
          },
          get selector() {
            return prefs['notification.sound.media.custom2.selector'];
          }
        },
        custom3: {
          get type() { // 0-3: built-in, 4: user defined
            return prefs['notification.sound.media.custom3.type'];
          },
          get file() {
            return prefs['notification.sound.media.custom3.file'];
          },
          get mime() {
            return prefs['notification.sound.media.custom3.mime'];
          },
          get filter() {
            return prefs['notification.sound.media.custom3.filter'];
          },
          get selector() {
            return prefs['notification.sound.media.custom3.selector'];
          }
        },
        custom4: {
          get type() { // 0-3: built-in, 4: user defined
            return prefs['notification.sound.media.custom4.type'];
          },
          get file() {
            return prefs['notification.sound.media.custom4.file'];
          },
          get mime() {
            return prefs['notification.sound.media.custom4.mime'];
          },
          get filter() {
            return prefs['notification.sound.media.custom4.filter'];
          },
          get selector() {
            return prefs['notification.sound.media.custom4.selector'];
          }
        }
      };
      const filters = [0, 1, 2, 3, 4].map(index => ({
        filter: media['custom' + index].filter,
        selector: media['custom' + index].selector,
        index
      })).filter(o => o.filter).filter(obj => {
        const keyword = obj.filter.toLowerCase();
        if (obj.selector === 0) {
          return entries.reduce((p, c) => {
            return p || (
              c.author_email.toLowerCase().includes(keyword) ||
              c.author_name.toLowerCase().includes(keyword)
            );
          }, false);
        }
        if (obj.selector === 1) {
          return entries.reduce((p, c) => p || c.title.toLowerCase().includes(keyword), false);
        }
        if (obj.selector === 2) {
          return entries.reduce((p, c) => p || c.summary.toLowerCase().includes(keyword), false);
        }
        return false;
      });

      offscreen.command({
        cmd: 'play',
        media,
        index: filters.length ? filters[0].index : null,
        prefs: {
          alert: prefs.alert,
          soundVolume: prefs.soundVolume
        }
      });
    });
  });
};

sound.stop = () => offscreen.command({
  cmd: 'stop'
});
