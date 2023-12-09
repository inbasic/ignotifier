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
          active: false,
          index: tabs && tabs.length ? tabs[0].index + 1 : undefined
        });
      });

      return true;
    }
  };

  // https://github.com/inbasic/ignotifier/issues/634
  onclick = e => e.button === 0 && (e.ctrlKey || e.metaKey) && block(e);
  onauxclick = e => e.button === 1 && block(e);
}
