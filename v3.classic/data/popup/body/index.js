{
  const block = e => {
    const target = e.target;

    const a = target.closest('a') || target;
    const url = a.dataset.href || a.href || a.src || target.src || target.href;

    if (url) {
      e.preventDefault();
      e.stopPropagation();

      chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      }, tabs => {
        chrome.tabs.create({
          url,
          active: false, // allow the user to open multiple links
          index: tabs && tabs.length ? tabs[0].index + 1 : undefined
        });
      });
      return false;
    }
    return true;
  };

  // https://github.com/inbasic/ignotifier/issues/634
  onclick = e => {
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
      return block(e);
    }
    return true;
  };
  onauxclick = e => {
    if (e.button === 1) {
      return block(e);
    }
    return true;
  };
}

// Key binding
addEventListener('keyup', top.keyup);
