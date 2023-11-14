/* globals locale */
'use strict';

var utils = {};

utils.prettyDate = time => {
  const date = new Date((time || ''));
  const diff = (((new Date()).getTime() - date.getTime()) / 1000);
  const dayDiff = Math.floor(diff / 86400);

  if (isNaN(dayDiff) || dayDiff < 0) {
    return 'just now';
  }
  return dayDiff === 0 && (
    diff < 60 && locale.get('popup_msg_1') ||
    diff < 120 && locale.get('popup_msg_2') ||
    diff < 3600 && locale.get('popup_msg_3_format').replace('%d', Math.floor(diff / 60)) ||
    diff < 7200 && locale.get('popup_msg_4') ||
    diff < 86400 && Math.floor(diff / 3600) + ' ' + locale.get('popup_msg_5')) ||
    dayDiff === 1 && locale.get('popup_msg_6') ||
    dayDiff < 7 && locale.get('popup_msg_7_format').replace('%d', dayDiff) ||
    dayDiff < 7 * 7 && locale.get('popup_msg_8_format').replace('%d', Math.ceil(dayDiff / 7)) ||
    dayDiff < 7 * 4 * 3 && locale.get('popup_msg_9_format').replace('%d', Math.ceil(dayDiff / 7 / 4)) ||
    locale.get('popup_date_format')
      .replace('%dd', date.getDate())
      .replace('%yy', date.getFullYear().toString())
      .replace('%mm', [
        locale.get('popup_msg_10'),
        locale.get('popup_msg_11'),
        locale.get('popup_msg_12'),
        locale.get('popup_msg_13'),
        locale.get('popup_msg_14'),
        locale.get('popup_msg_15'),
        locale.get('popup_msg_16'),
        locale.get('popup_msg_17'),
        locale.get('popup_msg_18'),
        locale.get('popup_msg_19'),
        locale.get('popup_msg_20'),
        locale.get('popup_msg_21')
      ][date.getMonth()]);
};
