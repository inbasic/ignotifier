self.port.on("command", function (unreadObjs) { /* {link, count, account, entries{id, title, summary, author_name, author_email, modified, link}} */
  if (unreadObjs.length) {
    var entries = unreadObjs[0].entries;
    if (entries.length) {
      var entry = entries[0];
      console.error(entry.link);
      // Mark first unread email as read!
      self.port.emit("action", entry.link, "rd");
    }
  }
});

