/* global gmail */
const ids = new Set();

const exit = () => {
  clearTimeout(exit.id);
  exit.id = setTimeout(() => {
    console.log('exit request', ids.size);

    if (ids.size === 0) {
      chrome.runtime.sendMessage({
        method: 'exit-offscreen'
      });
    }
  }, 60000);
};

const play = request => {
  const audio = document.createElement('audio');
  audio.setAttribute('preload', 'auto');
  audio.setAttribute('autobuffer', 'true');
  audio.onerror = audio.onended = () => {
    ids.delete(request.id);
    exit();
  };
  document.body.append(audio);

  const {index, media, prefs} = request;

  const type = index === null ? media.default.type : media['custom' + index].type;
  let path = '/data/sounds/' + type + '.wav';
  if (type === 4) {
    path = index === null ? media.default.file : media['custom' + index].file;
  }
  audio.src = path;
  audio.volume = prefs.soundVolume / 100;
  audio.play();
};

const stop = () => {
  for (const e of document.querySelectorAll('audio')) {
    e.pause();
    e.remove();
  }
};

chrome.runtime.onMessage.addListener(({request, method}, sender, response) => {
  if (method === 'offscreen') {
    console.log('offscreen', request);

    clearTimeout(exit.id);
    const id = Math.random();
    request.id = id;
    ids.add(id);

    if (request.cmd === 'play') {
      play(request);
      response(true);
    }
    else if (request.cmd === 'stop') {
      stop(request);
      response(true);
      ids.delete(request.id);
      exit();
    }
    else if (request.cmd === 'gmail.action') {
      gmail.action(request.request).then(() => response(true)).catch(response).finally(() => {
        ids.delete(request.id);
        exit();
      });
      return true;
    }
    else if (request.cmd === 'gmail.search') {
      gmail.search(request.request).then(response).catch(response).finally(() => {
        ids.delete(request.id);
        exit();
      });
      return true;
    }
  }
});

chrome.runtime.sendMessage({
  method: 'offscreen-ready'
});
