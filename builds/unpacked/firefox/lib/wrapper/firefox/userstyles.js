/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");
const unload = require("sdk/system/unload").when;

const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);

function getURI(aURL) Cc["@mozilla.org/network/io-service;1"]
    .getService(Ci.nsIIOService).newURI(aURL, null, null);

function setOptions(url, options) {
  let newOptions = {};
  options = options || {};

  newOptions.uri = getURI(url);
  newOptions.type = (options.type || 'user').toLowerCase();
  newOptions.type = (newOptions.type == 'agent') ? sss.AGENT_SHEET : sss.USER_SHEET;

  return newOptions;
};

/**
 * Load various packaged styles for the add-on and undo on unload
 *
 * @usage load(aURL): Load specified style
 * @param [string] aURL: Style file to load
 * @param [object] options:
 */
const loadSS = exports.load = function loadSS(url, options) {
  let { uri, type } = setOptions(url, options);

  // load the stylesheet
  sss.loadAndRegisterSheet(uri, type);

  // unload the stylesheet on unload
  unload(unregisterSS.bind(null, url, options));
};

const registeredSS = exports.registered = function registeredSS(url, options) {
  let { uri, type } = setOptions(url, options);

  // check that the stylesheet is registered
  return !!sss.sheetRegistered(uri, type);
};

const unregisterSS = exports.unload = function unregisterSS(url, options) {
  let { uri, type } = setOptions(url, options);

  // unregister the stylesheet
  sss.unregisterSheet(uri, type);
};
