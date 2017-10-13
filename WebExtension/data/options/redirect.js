'use strict';

var count = 5;
var timer = document.getElementById('timer');
var a = document.getElementById('a');
var id;

id = window.setInterval(() => {
  count -= 1;
  timer.textContent = '(' + count + ')';
  if (count === 0) {
    a.click();
  }
}, 1000);

a.addEventListener('click', e => {
  e.preventDefault();

  window.clearTimeout(id);

  timer.textContent = '';

  chrome.tabs.create({
    url: chrome.runtime.getURL('/data/options/index.html')
  }, () => window.close());
});
