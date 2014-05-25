// Club AJAX General Purpose Code
//
// getPlainText()
//
// author:
//    Mike Wilcox
// site:
//    http://clubajax.org
// support:
//    http://groups.google.com/group/clubajax
//
//
//  DESCRIPTION:
//    Returns a line-break, properly spaced, normailized plain text
//    representation of multiple child nodes which can't be done via
//    textContent or innerText because those two methods are vastly
//    different, and even innerText works differently across browsers.
//
//
var prefs = require("sdk/simple-prefs").prefs,
    windows = {
      get active () {
        return require('sdk/window/utils').getMostRecentBrowserWindow()
      }
    };

function colorToHex(color) {
  if (color.substr(0, 1) === '#') {
      return color;
  }
  var digits = /(.*?)rgb\((\d+), (\d+), (\d+)\)/.exec(color);

  var red = parseInt(digits[2]);
  var green = parseInt(digits[3]);
  var blue = parseInt(digits[4]);

  var rgb = blue | (green << 8) | (red << 16);
  return digits[1] + '#' + rgb.toString(16);
};

    
    
exports.getPlainText = function(node, link){
  var normalize = function(a){
    if(!a) return "";
    return a
      .replace(/ +/g, " ")
      .replace(/[\t]+/gm, "")
      .replace(/[ ]+$/gm, "")
      .replace(/^[ ]+/gm, "")
      .replace(/\n{2,}/g, "\n\n")
      .replace(/\n+$/, "")
      .replace(/^\n+/, "")
      .replace(/\nNEWLINE\n/g, "\n\n")
      .replace(/NEWLINE\n/g, "\n\n")
      .replace(/NEWLINE/g, "\n");
  }
  var removeWhiteSpace = function(node){
    var isWhite = function(node) {
      return !(/[^\t\n\r ]/.test(node.nodeValue));
    }
    var ws = [];
    var findWhite = function(node){
      for (var i = 0; i < node.childNodes.length; i++){
        var n = node.childNodes[i];
        if (n.nodeType == 3 && isWhite(n)){
          ws.push(n)
        }else if(n.hasChildNodes()){
          findWhite(n);
        }
      }
    }
    findWhite(node);
    for(var i=0; i< ws.length; i++) {
      ws[i].parentNode.removeChild(ws[i])
    }
  }
  var sty = function(n, prop) {
    var s = n.currentStyle || windows.active.getComputedStyle(n, null);
    if(n.tagName == "SCRIPT") return "none";
    if(!s[prop]) return "LI,P,TR".indexOf(n.tagName) > -1 ? "block" : n.style[prop];
    if(s[prop] =="block" && n.tagName=="TD") return "feaux-inline";
    return s[prop];
  }

  var blockTypeNodes = "table-row,block,list-item";
  var isBlock = function(n){
    var s = sty(n, "display") || "feaux-inline";
    if(blockTypeNodes.indexOf(s) > -1) return true;
    return false;
  }
  var recurse = function(n){
    if(/pre/.test(sty(n, "whiteSpace"))) {
      t += n.innerHTML
        .replace(/\t/g, " ")
        .replace(/\n/g, " ");
      return "";
    }
    var s = sty(n, "display");
    if(s == "none") return "";
    var gap = isBlock(n) ? "\n" : " ";
    t += gap;
    for (var i=0; i<n.childNodes.length;i++) {
      var c = n.childNodes[i];
      if (c.localName == "a" && c.href && c.textContent) {
        t += "<a href='" + c.href + "'>" + c.textContent + "</a>";
      }
      if (c.localName === "img" && c.src) {
        var href;
        if (c.src.contains("http")) {
          href = c.src;
        }
        else if (c.src.contains("mail/u/")) {
          href = "https://mail.google.com" + c.src;
        }
        else {
          href = link + c.src;
        }
        t += "<img src='" + href + "'></img>";
      }
      else if (c.nodeType == 3) {
        var color;
        try {
          color = windows.active.getComputedStyle(c.parentNode, null).getPropertyValue("color");
        } catch (e) {}
        if (color && color !== "rgb(0, 0, 0)") {
          t += '<font color="' + colorToHex (color) + '">' + c.nodeValue + '</font>';
        }
        else {
          t += c.nodeValue;
        }
      }
      else if(c.childNodes.length) {
        recurse(c);
      }
    }
    t += gap;
    t =t.replace(/(<[^>^<]+>)/ig, function (s){ //Strip HTML tags
      var safe = s.contains("<a href") || s.contains("</a>") || s.contains("<img src") || s.contains("</img>") || s.contains("<font color") || s.contains("</font>");
      return safe ? s : s.replace(/\</g, "&lt;").replace(/\>/g, "&gt;");
    });
    return t;
  }
  node = node.cloneNode(true);
  node.innerHTML = node.innerHTML.replace(/<br>/g, "\n");
  var paras = node.getElementsByTagName("p");
  for(var i=0; i<paras.length;i++){
    paras[i].innerHTML += "NEWLINE";
  }
  var t = "";
  removeWhiteSpace(node);
  return normalize(recurse(node))
    .replace(/^\s\s*/, '').replace(/\s\s*$/, '')
    .replace(/\n\s{2,}\n/g, '\n\n');
}
