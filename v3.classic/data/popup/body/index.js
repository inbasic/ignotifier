// https://github.com/inbasic/ignotifier/issues/634
onclick = e => {
  // Only handle middle click
  if (
    (e.button === 0 && (e.ctrlKey || e.metaKey)) ||
    (e.button === 1)
  ) {
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
          active: false,
          index: tabs && tabs.length ? tabs[0].index + 1 : undefined
        });
      });

      return true;
    }
  }
};
