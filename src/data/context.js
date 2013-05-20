self.port.on("list", function (unreadObjs) { /* {link, count, account, entries{id, title, summary, author_name, author_email, modified, link}} */


  console.error(unreadObjs[0].entries[0].modified);
  console.error(unreadObjs[0].entries[0].link);
 
});