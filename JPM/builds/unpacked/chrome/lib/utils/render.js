'use strict';

var isFirefox = typeof require !== 'undefined', win, render;
if (isFirefox) {
  var Cc = require('chrome').Cc;
  var Ci = require('chrome').Ci;
  var app = require('../wrapper/firefox/app');
  render = exports;
  win = function () {
    return require('sdk/window/utils').getMostRecentBrowserWindow();
  };
}
else {
  render = {};
  win = function () {
    return window;
  };
}

function getLastMessage (responseText) {
  var html = app.parser().parseFromString(responseText, 'text/html');
  var message = html.documentElement.getElementsByClassName('message');
  var body = '';
  try {
    body = message[message.length - 1].children[0].children[2];
  } catch (e) {}
  return body;
}

render.getHTMLText = function (req, link, feed) {
  function parseHTML(doc, html, allowStyle, baseURI, isXML) {
    const PARSER_UTILS = '@mozilla.org/parserutils;1';
    if (PARSER_UTILS in Cc) {
      var parser = Cc[PARSER_UTILS].getService(Ci.nsIParserUtils);
      if ('parseFragment' in parser) {
        return parser.parseFragment(
          html,
          allowStyle ? parser.SanitizerAllowStyle : 0,
          !!isXML,
          baseURI,
          doc.documentElement
        );
      }
    }
    return Cc['@mozilla.org/feed-unescapehtml;1']
      .getService(Ci.nsIScriptableUnescapeHTML)
      .parseFragment(html, !!isXML, baseURI, doc.documentElement);
  }
  if (isFirefox) {
    var fragment = parseHTML(win().document, req.responseText, true, req.channel.URI);
    try {
      var message = fragment.querySelector('.bodycontainer');
      return message
        .innerHTML
        .replace(/src\=\"\/mail\/u\//g, 'src="https://mail.google.com/mail/u/')
        .replace(/\?ui\=2\&/g, link + '?ui=2&')
        .replace(/<u\/\>/g, '')
        .replace(/display\:none\!important\;/g, '')
        .replace('[Quoted text hidden]', '<a href="' + feed + '">[Quoted text hidden]</a>');
    }
    catch (e) {
      return '...';
    }
  }
  else {
    var body = getLastMessage(req.responseText);
    return body ?
      body.innerHTML
        .replace(/src\=\"\/mail\/u\//g, 'src="https://mail.google.com/mail/u/')
        .replace(/\?ui\=2\&/g, link + '?ui=2&')
        .replace(/<u\/\>/g, '')
        .replace('[Quoted text hidden]', '<a href="' + feed + '">[Quoted text hidden]</a>') :
      req.responseText;
  }
};

render.getPlainText = function (req) {
  var body = getLastMessage(req.responseText) || '...';

  var normalize = function (a) {
    if (!a) {
      return '';
    }
    return a
      .replace(/ +/g, ' ')
      .replace(/[\t]+/gm, '')
      .replace(/[ ]+$/gm, '')
      .replace(/^[ ]+/gm, '')
      .replace(/\n{2,}/g, '\n\n')
      .replace(/\n+$/, '')
      .replace(/^\n+/, '')
      .replace(/\nNEWLINE\n/g, '\n\n')
      .replace(/NEWLINE\n/g, '\n\n')
      .replace(/NEWLINE/g, '\n');
  };
  var removeWhiteSpace = function (node) {
    var isWhite = function (node) {
      return !(/[^\t\n\r ]/.test(node.nodeValue));
    };
    var ws = [];
    var findWhite = function (node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var n = node.childNodes[i];
        if (n.nodeType === 3 && isWhite(n)) {
          ws.push(n);
        }
        else if (n.hasChildNodes()) {
          findWhite(n);
        }
      }
    };
    findWhite(node);
    for (var i = 0; i < ws.length; i++) {
      ws[i].parentNode.removeChild(ws[i]);
    }
  };
  var sty = function (n, prop) {
    var s = n.currentStyle || win().getComputedStyle(n, null);
    if (n.tagName === 'SCRIPT') {
      return 'none';
    }
    if (!s[prop]) {
      return 'LI,P,TR'.indexOf(n.tagName) > -1 ? 'block' : n.style[prop];
    }
    if (s[prop] === 'block' && n.tagName === 'TD') {
      return 'feaux-inline';
    }
    return s[prop];
  };

  var blockTypeNodes = 'table-row,block,list-item';
  var isBlock = function (n) {
    var s = sty(n, 'display') || 'feaux-inline';
    if (blockTypeNodes.indexOf(s) > -1) {
      return true;
    }
    return false;
  };
  function recurse (n) {
    if (/pre/.test(sty(n, 'whiteSpace'))) {
      t += n.innerHTML
        .replace(/\t/g, ' ')
        .replace(/\n/g, ' ');
      return '';
    }
    var s = sty(n, 'display');
    if (s === 'none') {
      return '';
    }
    var gap = isBlock(n) ? '\n' : ' ';
    t += gap;
    for (var i = 0; i < n.childNodes.length; i++) {
      var c = n.childNodes[i];
      if (c.localName === 'a' && c.href && c.textContent) {
        t += "<a href='" + c.href + "'>" + c.textContent + '</a>';
      }
      else if (c.nodeType === 3) {
        t += c.nodeValue;
      }
      else if (c.childNodes.length) {
        recurse(c);
      }
    }
    t += gap;
    t = t.replace(/(<[^>^<]+>)/ig, function (s) { //Strip HTML tags
      return s.indexOf('<a href') !== -1 || s.indexOf('</a>') !== -1 ? s : s.replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
    });
    return t;
  }
  var node = body.cloneNode(true);
  node.innerHTML = node.innerHTML.replace(/<br>/g, '\n');
  var paras = node.getElementsByTagName('p');
  for (var i = 0; i < paras.length; i++) {
    paras[i].innerHTML += 'NEWLINE';
  }
  var t = '';
  removeWhiteSpace(node);

  return normalize(recurse(node))
    .replace(/^\s\s*/, '').replace(/\s\s*$/, '')
    .replace(/\n\s{2,}\n/g, '\n\n')
    .replace(/\n/g, '<br>');
};
