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

var windows = {
  get active () { // Chrome window
    return require('sdk/window/utils').getMostRecentBrowserWindow()
  },
  get activeWindow () { // SDK window
    return require("sdk/windows").browserWindows.activeWindow
  }
};

exports.getPlainText = function(node){
  // used for testing:
  //return node.innerText || node.textContent;


  var normalize = function(a){
    // clean up double line breaks and spaces
    if(!a) return "";
    return a.replace(/ +/g, " ")
        .replace(/[\t]+/gm, "")
        .replace(/[ ]+$/gm, "")
        .replace(/^[ ]+/gm, "")
        .replace(/\n{2,}/g, "\n\n")
        .replace(/\n+$/, "")
        .replace(/^\n+/, "")
        .replace(/\nNEWLINE\n/g, "\n\n")
        .replace(/NEWLINE\n/g, "\n\n"); // IE
  }
  var removeWhiteSpace = function(node){
    // getting rid of empty text nodes
    var isWhite = function(node) {
      return !(/[^\t\n\r ]/.test(node.nodeValue));
    }
    var ws = [];
    var findWhite = function(node){
      for(var i=0; i<node.childNodes.length;i++){
        var n = node.childNodes[i];
        if (n.nodeType==3 && isWhite(n)){
          ws.push(n)
        }else if(n.hasChildNodes()){
          findWhite(n);
        }
      }
    }
    findWhite(node);
    for(var i=0;i<ws.length;i++){
      ws[i].parentNode.removeChild(ws[i])
    }

  }
  var sty = function(n, prop){
    // Get the style of the node.
    // Assumptions are made here based on tagName.
    var s = n.currentStyle || windows.active.getComputedStyle(n, null);
    if(n.tagName == "SCRIPT") return "none";
    if(!s[prop]) return "LI,P,TR".indexOf(n.tagName) > -1 ? "block" : n.style[prop];
    if(s[prop] =="block" && n.tagName=="TD") return "feaux-inline";
    return s[prop];
  }

  var blockTypeNodes = "table-row,block,list-item";
  var isBlock = function(n){
    // diaply:block or something else
    var s = sty(n, "display") || "feaux-inline";
    if(blockTypeNodes.indexOf(s) > -1) return true;
    return false;
  }
  var recurse = function(n){
    // Loop through all the child nodes
    // and collect the text, noting whether
    // spaces or line breaks are needed.
    if(/pre/.test(sty(n, "whiteSpace"))) {
      t += n.innerHTML
        .replace(/\t/g, " ")
        .replace(/\n/g, " "); // to match IE
      return "";
    }
    var s = sty(n, "display");
    if(s == "none") return "";
    var gap = isBlock(n) ? "\n" : " ";
    t += gap;
    for(var i=0; i<n.childNodes.length;i++){
      var c = n.childNodes[i];
      if(c.nodeType == 3) t += c.nodeValue;
      if(c.childNodes.length) recurse(c);
    }
    t += gap;
    return t;
  }
  // Use a copy because stuff gets changed
  node = node.cloneNode(true);
  // Line breaks aren't picked up by textContent
  node.innerHTML = node.innerHTML.replace(/<br>/g, "\n");

  // Double line breaks after P tags are desired, but would get
  // stripped by the final RegExp. Using placeholder text.
  var paras = node.getElementsByTagName("p");
  for(var i=0; i<paras.length;i++){
    paras[i].innerHTML += "NEWLINE";
  }

  var t = "";
  removeWhiteSpace(node);
  // Make the call!
  return normalize(recurse(node));
}
