try {
  importScripts('engines/rss/core.js', 'engines/api/core.js', 'engines/native/core.js');
  importScripts('sax.js');
  importScripts('core.js', 'accounts.js', 'configs.js', 'background.js', 'badge.js');
}
catch (e) {
  console.warn(e);
}

