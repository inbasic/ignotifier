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
  let i = 0;
  const t = [];
  const clean = () => {
    t.forEach(id => clearTimeout(id));
    t.length = 0;
  };
  Object.defineProperty(button, 'icon', {
    set(clr) {
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

        clean();
        if (clr === 'load') {
          t.push(setTimeout(() => {
            set('load' + i);
            i += 1;
            i = i % 4;
            button.icon = 'load';
          }, 200));
        }
        else if (clr === 'new') {
          t.push(setTimeout(() => {
            set(i % 2 ? 'red' : 'new');
            if (i < 7) {
              i += 1;
              button.icon = 'new';
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
