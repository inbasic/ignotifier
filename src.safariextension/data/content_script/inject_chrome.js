/* global background, gmonkey */
'use strict';

function inject () {
  window.removeEventListener('DOMContentLoaded', inject, false);
  var script = document.createElement('script');
  function refresh () {
    window.addEventListener('message', function (e) {
      if (e.data !== 'ignotifier-refresh') {
        return;
      }
      if ('gmonkey' in window) {
        gmonkey.load('2.0', function (api) {
          if (api.getActiveViewType() !== 'tl') {
            return;
          }
          var labels = api.getSystemLabelsElement();
          if (labels) {
            labels = labels.parentNode;
            var active = labels.querySelector('[tabindex="0"]');
            if (active) {
              active.click();
            }
          }
        });
      }
    }, false);
  }
  script.src = 'data:text/javascript,(' + refresh + ')();';
  document.body.appendChild(script);
}

window.addEventListener('DOMContentLoaded', inject, false);

background.receive('refresh', function () {
  window.postMessage('ignotifier-refresh', '*');
});
console.error('loaded');
