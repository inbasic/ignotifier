var isFirefox = typeof InstallTrigger !== 'undefined',
    isSafari = typeof safari !== 'undefined',
    isOpera = typeof chrome !== 'undefined' && navigator.userAgent.indexOf("OPR") !== -1,
    isChrome = typeof chrome !== 'undefined' && navigator.userAgent.indexOf("OPR") === -1;

function script (src, callback) {
  var head = document.querySelector('head');
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = src;
  script.onload = callback;
  head.appendChild(script);
}


if (isSafari) {
  script('../../lib/wrapper/safari/i18next-1.7.4.js', function () {
    i18n.init({
      resGetPath: "../../_locales/en/messages.json"
    }, function () {
      var elems = document.querySelectorAll("*[data-l10n-id]");
      [].forEach.call(elems, function (elem) {
        elem.textContent = i18n.t(elem.getAttribute("data-l10n-id") + ".message");
      });
    });
  });
  script('index.js');
}

if (isChrome || isOpera) {
  var elems = document.querySelectorAll("*[data-l10n-id]");
  [].forEach.call(elems, function (elem) {
    elem.textContent = chrome.i18n.getMessage(elem.getAttribute("data-l10n-id"));
  });
  script('index.js');
}
