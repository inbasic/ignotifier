/* global checkEmails */
const repeater = {
  reason: ''
};
repeater.build = (type = 'normal', reason, delay) => chrome.storage.local.get({
  'period': 60, // seconds
  'initialPeriod': 3 // seconds
}, prefs => {
  repeater.reason = reason;

  let when = 0;
  if (!isNaN(delay)) {
    when = delay;
  }
  else if (type === 'normal') {
    when = (prefs.initialPeriod || 5) * 1000;
  }
  else if (type === 'fired') {
    when = prefs.period * 1000;
  }
  console.log(`Repeater Build`, `Reason: "${reason}"`, `Type: "${type}"`, `Delay: ${when}ms`);
  chrome.alarms.create('repeater', {
    when: Date.now() + when,
    periodInMinutes: prefs.period / 60
  });
});

repeater.reset = (reason, delay) => repeater.build('now', reason, delay);

/* alarm */
chrome.alarms.onAlarm.addListener(o => {
  if (o.name === 'repeater') {
    repeater.build('fired', 'alarm.fired'); // make sure we can handle less than a minute calls

    const forced = ['user.request', 'options.changes', 'change.of.feeds', 'popup.forced'].includes(repeater.reason);
    checkEmails.execute(forced);

    chrome.storage.local.get({
      'initialPeriod': 3 // seconds
    }, prefs => {
      if (prefs.initialPeriod === 0) { // manual mode
        chrome.alarms.onAlarm.remove('repeater');
      }
    });
  }
});
/* startup */
chrome.runtime.onStartup.addListener(() => repeater.build('normal', 'startup'));
chrome.runtime.onInstalled.addListener(() => repeater.build('normal', 'startup'));

/* idle */
chrome.runtime.onStartup.addListener(() => chrome.storage.local.get({
  'idle-detection': 5 // minutes
}, prefs => {
  chrome.idle.setDetectionInterval(prefs['idle-detection'] * 60);
}));
chrome.idle.onStateChanged.addListener(name => {
  if (name === 'active') {
    repeater.reset('exit.idle');
  }
});
/* pref changes */
chrome.storage.onChanged.addListener(prefs => {
  if (prefs.minimal ||
    prefs.feeds_0 || prefs.feeds_1 || prefs.feeds_2 || prefs.feeds_3 || prefs.feeds_4 || prefs.feeds_5 ||
    prefs.feeds_custom
  ) {
    repeater.reset('change.of.feeds');
  }
  if (prefs.clrPattern || prefs.badge) {
    repeater.reset('options.changes');
  }
  if (prefs.period) {
    repeater.reset('period.changed');
  }
  if (prefs.oldFashion) {
    repeater.reset('options.changes');
  }
});
