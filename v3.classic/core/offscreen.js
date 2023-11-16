/* global log */

const offscreen = {
  busy: false,
  cache: []
};

offscreen.command = async request => {
  if (offscreen.busy) {
    return new Promise(resolve => {
      offscreen.cache.push({request, resolve});
    });
  }
  offscreen.busy = true;

  // do we have an active offscreen worker
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (existingContexts.length === 0) {
    log('[offscreen]', 'creating...');
    await chrome.offscreen.createDocument({
      url: '/core/offscreen/index.html',
      reasons: ['AUDIO_PLAYBACK', 'DOM_SCRAPING'],
      justification: 'parse a command or play alert'
    });
  }
  offscreen.busy = false;
  for (const {request, resolve} of offscreen.cache) {
    chrome.runtime.sendMessage({
      method: 'offscreen',
      request
    }, resolve);
  }
  offscreen.cache.length = 0;

  return new Promise(resolve => chrome.runtime.sendMessage({
    method: 'offscreen',
    request
  }, resolve));
};

chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'exit-offscreen') {
    chrome.offscreen.closeDocument().then(() => {
      log('[offscreen]', 'exited');
    });
  }
});
