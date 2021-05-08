const isFirefox = /Firefox/.test(navigator.userAgent) || typeof InstallTrigger !== 'undefined';

const core = {};
core.storage = {
  read(prefs) {
    return new Promise(resolve => chrome.storage.local.get(prefs, resolve));
  },
  write(prefs) {
    return new Promise(resolve => chrome.storage.local.set(prefs, resolve));
  },
  changed(c) {
    chrome.storage.onChanged.addListener(c);
  }
};
core.log = (...args) => console.log((new Date()).toLocaleTimeString(), ...args);

core.action = {
  set(color, badge, title) {
    chrome.browserAction.setIcon({
      path: {
        '16': 'data/icons/colors/' + color + '/16.png',
        '32': 'data/icons/colors/' + color + '/32.png'
      }
    });
    chrome.browserAction.setBadgeText({
      text: badge + ''
    });
    chrome.browserAction.setTitle({
      title
    });
  },
  badge() {
    return new Promise(resolve => chrome.browserAction.getBadgeText({}, resolve));
  },
  popup(popup) {
    chrome.browserAction.setPopup({popup});
  },
  click(c) {
    chrome.browserAction.onClicked.addListener(c);
  },
  color(color) {
    chrome.browserAction.setBadgeBackgroundColor({
      color
    });
  }
};

core.page = {
  open(props) {
    return new Promise(resolve => chrome.tabs.create(props, resolve));
  },
  options() {
    chrome.runtime.openOptionsPage();
  },
  focus(tab) {
    chrome.tabs.update(tab.id, {
      active: true
    });
    chrome.windows.update(tab.windowId, {
      focused: true
    });
  }
};

core.i18n = {
  get(id) {
    return chrome.i18n.getMessage(id);
  }
};

core.runtime = {
  start(c) {
    chrome.runtime.onInstalled.addListener(c);
    chrome.runtime.onStartup.addListener(c);
  },
  message(c) {
    chrome.runtime.onMessage.addListener(c);
  },
  bg() {
    return new Promise(resolve => chrome.runtime.getBackgroundPage(resolve));
  },
  post(o) {
    chrome.runtime.sendMessage(o, () => chrome.runtime.lastError);
  },
  reload() {
    chrome.runtime.reload();
  },
  connect(prps) {
    chrome.runtime.connect(prps);
  },
  port(c) {
    chrome.runtime.onConnect.addListener(c);
  }
};

core.alarms = {
  create(...args) {
    chrome.alarms.create(...args);
  },
  fired(c) {
    chrome.alarms.onAlarm.addListener(c);
  }
};

core.notify = {
  create(name, o) {
    if (isFirefox) {
      delete o.buttons;
    }
    chrome.notifications.create(name, {
      type: 'basic',
      iconUrl: '/data/icons/colors/red/48.png',
      title: chrome.runtime.getManifest().name,
      ...o
    });
  },
  fired(c) {
    chrome.notifications.onClicked.addListener(c);
  },
  buttons(c) {
    chrome.notifications.onButtonClicked.addListener(c);
  }
};

core.idle = {
  set(num) {
    chrome.idle.setDetectionInterval(num);
  },
  fired(c) {
    chrome.idle.onStateChanged.addListener(c);
  }
};

core.download = options => new Promise((resolve, reject) => {
  chrome.downloads.download(options, id => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      reject(lastError);
    }
    else {
      resolve(id);
    }
  });
});

core.context = {
  create(props) {
    chrome.contextMenus.create(props);
  },
  fired(c) {
    chrome.contextMenus.onClicked.addListener(c);
  }
};
