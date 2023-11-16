'use strict';

var config = {};

config.map = {
  number: [
    'period', 'resetPeriod', 'initialPeriod', 'notificationTime', 'notificationTruncate',
    'notification.sound.media.default.type', 'notification.sound.media.custom0.type',
    'notification.sound.media.custom1.type', 'notification.sound.media.custom2.type',
    'notification.sound.media.custom3.type', 'notification.sound.media.custom4.type',
    'notification.sound.media.custom0.selector', 'notification.sound.media.custom1.selector',
    'notification.sound.media.custom2.selector', 'notification.sound.media.custom3.selector',
    'notification.sound.media.custom4.selector',
    'soundVolume', 'silentTime', 'oldFashion', 'size', 'fullWidth', 'fullHeight',
    'clrPattern', 'threatAsNew'
  ],
  checkbox: [
    'notification', 'alert', 'combined', 'searchMode', 'ignoreOpens',
    'relatedToCurrent', 'currentTab', 'background', 'useBlankTabs',
    'newWindow', 'keyUp', 'render', 'doReadOnArchive', 'inboxRedirection',
    'alphabetic', 'onGmailNotification', 'minimal', 'welcome', 'badge',
    'plug-in/labels', 'express', 'basic.html', 'smartOpen',
    'notification.buttons.markasread', 'notification.buttons.archive', 'notification.buttons.trash'
  ]
};

config.prefs = {
  'period': 120, // seconds
  'initialPeriod': 3, // seconds
  'resetPeriod': 0, // minutes
  'feeds_0': '',
  'feeds_1': '',
  'feeds_2': '',
  'feeds_3': '',
  'feeds_4': '',
  'feeds_5': '',
  'feeds_custom': '',
  'notification': true,
  'notificationTime': 30, // seconds
  'notificationFormat': chrome.i18n.getMessage('notification'),
  'notificationTruncate': 70,
  'alert': true,
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
  'soundVolume': 80,
  'silentTime': 10, // minutes
  'combined': navigator.userAgent.indexOf('Firefox') !== -1,
  'searchMode': true,
  'ignoreOpens': false,
  'relatedToCurrent': false,
  'currentTab': false,
  'background': false,
  'useBlankTabs': false,
  'newWindow': false,
  'oldFashion': 0,
  'size': 0,
  'fullWidth': 750,
  'fullHeight': 600,
  'keyUp': false,
  'render': true,
  'doReadOnArchive': true,
  'inboxRedirection': true,
  'alphabetic': false,
  'clrPattern': 0,
  'onGmailNotification': true,
  'threatAsNew': 10, // minutes
  'minimal': true,
  'welcome': true,
  'badge': true,
  'backgroundColor': '#6e6e6e',
  'express': false,
  'notification.buttons.markasread': true,
  'notification.buttons.archive': true,
  'notification.buttons.trash': false,
  'basic.html': false,
  'smartOpen': true,
  // plug-ins
  'plug-in/labels': true
};
