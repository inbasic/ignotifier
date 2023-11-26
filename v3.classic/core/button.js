'use strict';

const button = {
  set label(title) {
    chrome.action.setTitle({title});
  },
  set color(color) {
    chrome.action.setBadgeBackgroundColor({color});
  }
};
// button.badge
{
  Object.defineProperty(button, 'badge', {
    set(val) {
      chrome.storage.local.get({
        'minimal': true,
        'badge': true
      }, prefs => {
        if (val > 999 && prefs.minimal) {
          const formatter = new Intl.NumberFormat('en-US', {
            notation: 'compact',
            compactDisplay: 'short'
          });
          val = '>' + formatter.format(val);
        }
        chrome.action.setBadgeText({
          text: val === 0 || prefs.badge === false ? '' : String(val)
        });
      });
    }
  });
}
// button.icon
{
  let id;
  Object.defineProperty(button, 'icon', {
    set(clr) {
      clearTimeout(id);

      chrome.storage.local.get({
        'clrPattern': 0 // 0: normal color scheme, 1: reverse color scheme
      }, prefs => {
        function set(clr) {
          // Change color pattern?
          if (prefs.clrPattern === 1) {
            switch (clr) {
            case 'blue':
              clr = 'gray';
              break;
            case 'gray':
              clr = 'blue';
              break;
            }
          }
          if (prefs.clrPattern === 2) {
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
          chrome.action.setIcon({
            path: {
              '16': '/data/icons/' + clr + '/16.png',
              '18': '/data/icons/' + clr + '/18.png',
              '19': '/data/icons/' + clr + '/19.png',
              '32': '/data/icons/' + clr + '/32.png'
            }
          });
        }

        if (clr === 'load') {
          const next = (i, n = 0) => {
            clearTimeout(id);
            if (n < 100) {
              id = setTimeout(() => {
                set('load' + i);
                i += 1;
                next(i % 4, n += 1);
              }, 200);
            }
            else {
              set('blue');
            }
          };
          next(0);
        }
        else if (clr === 'new') {
          const next = i => {
            clearTimeout(id);
            id = setTimeout(() => {
              set(i % 2 ? 'red' : 'new');
              if (i < 7) {
                i += 1;
                next(i);
              }
            }, 300);
          };
          next(0);
        }
        else {
          set(clr);
        }
      });
    }
  });
}

// once
{
  const once = () => chrome.storage.local.get({
    'backgroundColor': '#6e6e6e'
  }, prefs => button.color = prefs.backgroundColor);
  chrome.runtime.onStartup.addListener(once);
  chrome.runtime.onInstalled.addListener(once);
}
chrome.storage.onChanged.addListener(ps => {
  if (ps.backgroundColor) {
    button.color = ps.backgroundColor.newValue;
  }
});
