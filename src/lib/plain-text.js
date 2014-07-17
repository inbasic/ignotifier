var {Cc, Ci, Cu}  = require('chrome');
var windows = {
  get active () { // Chrome window
    return require('sdk/window/utils').getMostRecentBrowserWindow()
  }
}

function parseHTML(doc, html, allowStyle, baseURI, isXML) {
  const PARSER_UTILS = "@mozilla.org/parserutils;1";
  if (PARSER_UTILS in Cc) {
    let parser = Cc[PARSER_UTILS].getService(Ci.nsIParserUtils);
    if ("parseFragment" in parser) {
        return parser.parseFragment(
          html, 
          allowStyle ? parser.SanitizerAllowStyle : 0,
          !!isXML, 
          baseURI, 
          doc.documentElement
        );
    }
  }
  return Cc["@mozilla.org/feed-unescapehtml;1"]
    .getService(Ci.nsIScriptableUnescapeHTML)
    .parseFragment(html, !!isXML, baseURI, doc.documentElement);
}

exports.getPlainText = function (req, link) {
  var fragment = parseHTML(windows.active.document, req.responseText, true, req.channel.URI);
  try {
    var message = fragment.querySelectorAll(".message");
    message = message[message.length - 1].children[0].children[2];
    return message
      .innerHTML
      .replace(/src\=\"\/mail\/u\//g, 'src="https://mail.google.com/mail/u/')
      .replace(/\?ui\=2\&/g, link + "?ui=2&");
  }
  catch (e) {
    return "...";
  }
};