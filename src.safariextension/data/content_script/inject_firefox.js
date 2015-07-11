/* globals background, unsafeWindow */
'use strict';

background.receive('refresh', function () {
  var gmonkey = unsafeWindow.gmonkey;
  if (gmonkey) {
    gmonkey.load('2.0', function greetme (api) {
      api = api.wrappedJSObject;
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
});
