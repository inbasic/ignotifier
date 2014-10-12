var isFirefox = typeof InstallTrigger !== 'undefined';

if (!isFirefox) {
 var head = document.querySelector('head');
 var script = document.createElement('script');
 script.type = 'text/javascript';
 script.src = 'index.js';
 head.appendChild(script);
}