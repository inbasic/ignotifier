const isFirefox = /Firefox/.test(navigator.userAgent) || typeof InstallTrigger !== 'undefined';

const translate = async id => {
  const lang = navigator.language.split('-')[0];
  translate.objects = translate.objects || await Promise.all([
    fetch('_locales/' + lang + '/messages.json').then(r => r.json()).catch(() => ({})),
    fetch('_locales/en/messages.json').then(r => r.json())
  ]);
  return translate.objects[0][id]?.message || translate.objects[1][id]?.message || id;
};

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
  set(color, badge, id, extra = '') {
    (chrome.browserAction || chrome.action).setIcon({
      path: {
        '16': 'data/icons/colors/' + color + '/16.png',
        '32': 'data/icons/colors/' + color + '/32.png'
      }
    });
    (chrome.browserAction || chrome.action).setBadgeText({
      text: badge + ''
    });
    translate(id).then(title => (chrome.browserAction || chrome.action).setTitle({
      title: title + extra
    }));
  },
  badge() {
    return new Promise(resolve => (chrome.browserAction || chrome.action).getBadgeText({}, resolve));
  },
  popup(popup) {
    (chrome.browserAction || chrome.action).setPopup({popup});
  },
  click(c) {
    (chrome.browserAction || chrome.action).onClicked.addListener(c);
  },
  color(color) {
    (chrome.browserAction || chrome.action).setBadgeBackgroundColor({
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
  },
  translate(id) {
    return translate(id);
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
    if (typeof window === 'undefined') {
      props.contexts = props.contexts.map(s => s === 'browser_action' ? 'action' : s);
    }
    chrome.contextMenus.create(props);
  },
  fired(c) {
    chrome.contextMenus.onClicked.addListener(c);
  }
};
