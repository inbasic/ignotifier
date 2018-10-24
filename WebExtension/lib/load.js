/* globals config, app */
'use strict';

chrome.storage.local.get(config.prefs, ps => {
  // fix preferences from older versions
  if (ps.firstRun && ps.version) {
    config.map.number.forEach(name => ps[name] = Number(ps[name]));
    config.map.checkbox.forEach(name => {
      if (ps[name] === 'true') {
        ps[name] = true;
      }
      else if (ps[name] === 'false') {
        ps[name] = false;
      }
    });
    ps.firstRun = false;
    chrome.storage.local.set(ps);
  }

  Object.assign(config.prefs, ps);

  app.storage = {
    read: id => config.prefs[id],
    write: (id, data) => {
      config.prefs[id] = data;
      chrome.storage.local.set({
        [id]: data
      });
    }
  };
  // window.setTimeout(() => app.emit('load'), 2000);
  app.emit('load');
});
