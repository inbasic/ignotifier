var windows = {
  get active () { // Chrome window
    return require('sdk/window/utils').getMostRecentBrowserWindow()
  }
}

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

function sty (n, prop) {
  var s = windows.active.getComputedStyle(n, null);
  if( n.tagName == "SCRIPT") return "none";
  if (!s[prop]) return "LI,P,TR".indexOf(n.tagName) > -1 ? "block" : n.style[prop];
  if (s[prop] == "block" && n.tagName == "TD") return "feaux-inline";
  return s[prop];
}

function isBlock (n) {
  var s = sty(n, "display") || "feaux-inline";
  if("table-row,block,list-item".indexOf(s) > -1) return s;
  return null;
}

function normalize (a) {
  if(!a.trim()) return "";
  return a
    .replace(/ +/g, " ")
    .replace(/[\t]+/gm, "")
    .replace(/\n{2,}/g, "\n\n")
    
    .replace(/\</g, "&lt;")
    .replace(/\>/g, "&gt;")
}

function recurse (n, link) {
  var tmp = "";
  [].forEach.call(n.childNodes, function (c) {
    if (c.childNodes.length) {
      if (c.localName !== "style") {
        tmp += recurse (c, link);
      }
    }
    else {

      if (c.nodeValue) {
        if (c.parentNode.localName === "a") {
          tmp += '<a href="' + c.parentNode.href + '">' + c.nodeValue + '</a>';
        }
        else {
          var color = colorToHex (sty(n.parentNode, "color"));
          var bold = parseInt(sty(n.parentNode, "fontSize")) > 14;
          var t = normalize(c.nodeValue);
    
          if (color && color !== "#0") {
            t = '<font color="' + color + '">' + t + '</font>';
          }
          if (bold) {
            t = "<b>" + t + "</b>";
          }
          tmp += t;
        }
      }
      else {
        if (c.localName === "img") {
        
          var href = (function () {
            if (c.src.contains("http")) {
              return c.src;
            }
            if (c.src.contains("mail/u/")) {
              return "https://mail.google.com" + c.src;
            }
            return link + c.src;
          })();

          tmp += '<img style= "max-width: 475px;vertical-align:middle; padding-right: 5px;" src=' + href + '></img>'
        }
        else {
          if (c.localName === "br") {
            tmp += '<br/>';
          }
          else if (c.localName === "hr") {
            tmp += '<hr/>';
          }
          else {
            tmp += c.outerHTML;
          }
        }
      }
    }
  });

  if (isBlock (n)) {
    var container = n.localName;
    tmp = "<" + container  + ">" + tmp + "</" + container + ">";
  }
  tmp = tmp
    .replace(/^(?:\<br\/\>)+/, "") //no break at the start of emails
    .replace(/(?:\<br\/\>){2,}/g, "<br/><br/>");  // no multiple breaks
  
  return tmp;
}

exports.getPlainText = recurse;