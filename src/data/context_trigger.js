self.port.on("list", function(list) {
	document.defaultView.postMessage(list, "*");
});

document.documentElement.addEventListener("open_mail_link", function(event) {
  self.port.emit("open_mail", event.detail);
}, false);