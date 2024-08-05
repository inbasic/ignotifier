// Firefox workaround
chrome.offscreen = {
  closeDocument() {
    for (const e of document.querySelectorAll('iframe.offscreen')) {
      e.remove();
    }
    return Promise.resolve();
  },
  createDocument(q) {
    if (document.querySelector('iframe.offscreen')) {
      return Promise.reject(Error('ALREADY_ATTACHED'));
    }
    return new Promise(resolve => {
      const e = document.createElement('iframe');
      e.classList.add('offscreen');
      e.addEventListener('load', () => {
        e.addEventListener('load', resolve, {
          once: true
        });
        e.contentWindow.location.replace(q.url);
      }, {once: true});
      document.body.append(e);
    });
  }
};
chrome.runtime.getContexts = function(q) {
  if (q.contextTypes && q.contextTypes.includes('OFFSCREEN_DOCUMENT')) {
    return Promise.resolve([...document.querySelectorAll('iframe.offscreen')]);
  }
  else {
    return Promise.reject(Error('NOT_SUPPORTED'));
  }
};
