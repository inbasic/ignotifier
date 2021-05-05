/* globals self, alert, background  */
'use strict';

var isFirefox = typeof self !== 'undefined' && self.port;

var connect = function (elem, pref) {
  var att = 'value';
  if (elem) {
    if (elem.type === 'checkbox') {
      att = 'checked';
    }
    if (elem.localName === 'select') {
      att = 'selectedIndex';
    }
    if (elem.localName === 'span') {
      att = 'textContent';
    }
    pref = pref || elem.getAttribute('data-pref');
    background.send('get', pref);
    elem.addEventListener('change', function () {
      if (pref.endsWith('.file')) {
        var base = pref.replace('.file', '');
        var file = this.files[0];
        var input = document.querySelector('[data-pref="' + pref + '"]');
        if (input) {
          input.parentNode.style.display = 'none';
        }
        background.send('changed', {
          pref: base + '.mime',
          value: file.type
        });
        var reader = new FileReader();
        reader.onload = function (e) {
          background.send('changed', {
            pref,
            value: e.target.result
          });
        };
        reader.onerror = function (e) {
          alert(e);
        };
        reader.readAsDataURL(file);
      }
      else {
        background.send('changed', {
          pref: pref,
          value: this[att]
        });
      }
    });
  }
  return {
    get value () {
      return elem[att];
    },
    set value (val) {
      if (elem.type === 'file') {
        return;
      }
      elem[att] = val;
    }
  };
};

background.receive('set', function (o) {
  if (window[o.pref]) {
    window[o.pref].value = o.value;
  }
});

background.receive('custom-sound', function (pref) {
  if (isFirefox) {
    background.send('custom-sound', pref);
  }
  else {
    var input = document.querySelector('[data-pref="' + pref + '"]');
    if (input) {
      input.parentElement.style.display = 'inline-block';
    }
  }
});

window.addEventListener('DOMContentLoaded', function () {
  var prefs = document.querySelectorAll('*[data-pref]');
  [].forEach.call(prefs, function (elem) {
    var pref = elem.getAttribute('data-pref');
    window[pref] = connect(elem, pref);
  });
}, false);
