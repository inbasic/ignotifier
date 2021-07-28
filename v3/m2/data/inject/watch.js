let timeout = false;

const script = document.createElement('script');
script.addEventListener('change', e => {
  e.stopPropagation();
  e.preventDefault();

  if (timeout === false) {
    timeout = setTimeout(() => {
      timeout = false;
      chrome.runtime.sendMessage({
        method: 'soft-refresh'
      });
    }, 3000);
  }
});
script.textContent = `{
  const script = document.currentScript;
  const pointer = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
  let title;
  Object.defineProperty(document, 'title', {
    enumerable: true,
    configurable: true,
    get() {
      return title;
    },
    set(v) {
      if (title !== v) {
        script.dispatchEvent(new Event('change'));
      }
      title = v;
      pointer.set.call(this, v);
    }
  });
}`;
document.documentElement.appendChild(script);
script.remove();
