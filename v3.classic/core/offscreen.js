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
  const path = chrome.runtime.getURL('/core/offscreen/index.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [path]
  });
  if (existingContexts.length === 0) {
    console.log('creating offscreen');
    await chrome.offscreen.createDocument({
      url: path,
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
    chrome.offscreen.closeDocument(() => console.log('offscreen', 'exit'));
  }
});
