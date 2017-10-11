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
    'newWindow', 'keyUp', 'render', 'doReadOnArchive', 'alphabetic',
    'onGmailNotification', 'minimal'
  ]
};

config.prefs = {
  'period': 60, // seconds
  'initialPeriod': 3, // seconds
  'resetPeriod': 0, // minutes
  'feeds_0': 'inbox',
  'feeds_1': 'inbox',
  'feeds_2': 'inbox',
  'feeds_3': 'inbox',
  'feeds_4': 'inbox',
  'feeds_5': 'inbox',
  'feeds_custom': '',
  'notification': true,
  'notificationTime': 8, // seconds
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
  'size':0,
  'fullWidth': 750,
  'fullHeight': 600,
  'keyUp': false,
  'render': true,
  'doReadOnArchive': true,
  'alphabetic': false,
  'clrPattern': 0,
  'onGmailNotification': true,
  'threatAsNew': 10, // minutes
  'minimal': true
};
