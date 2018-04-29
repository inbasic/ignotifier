/* globals config, app */
'use strict';

var toolbar = {};

Object.defineProperty(toolbar, 'badge', {
  set(val) {
    if (val > 999 && config.ui.minimal) {
      val = '>' + Math.round(val / 1000) + 'K';
    }
    chrome.browserAction.setBadgeText({
      text: val === 0 || config.ui.badge === false ? '' : String(val)
    });
  }
});

Object.defineProperty(toolbar, 'color', {
  set(val) {
    chrome.browserAction.setBadgeBackgroundColor({
      color: val
    });
  }
});

{
  let i = 0;
  const t = [];
  function clearTimeout() {
    t.forEach(_t => {
      window.clearTimeout(_t);
      t.splice(t.indexOf(_t), 1);
    });
  }
  Object.defineProperty(toolbar, 'icon', {
    set(clr) {
      function set(clr) {
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
        chrome.browserAction.setIcon({
          path: {
            '16': '/data/icons/' + clr + '/16.png',
            '18': '/data/icons/' + clr + '/18.png',
            '19': '/data/icons/' + clr + '/19.png',
            '32': '/data/icons/' + clr + '/32.png'
          }
        });
      }

      clearTimeout();
      if (clr === 'load') {
        t.push(window.setTimeout(function() {
          set('load' + i);
          i += 1;
          i = i % 4;
          toolbar.icon = 'load';
        }, 200));
      }
      else if (clr === 'new') {
        t.push(window.setTimeout(function() {
          set(i % 2 ? 'red' : 'new');
          if (i < 7) {
            i += 1;
            toolbar.icon = 'new';
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
    }
  });
}

Object.defineProperty(toolbar, 'label', {
  set(title) {
    chrome.browserAction.setTitle({title});
  }
});

app.on('load', () => {
  toolbar.color = config.prefs.backgroundColor;
});
