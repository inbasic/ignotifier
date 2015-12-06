/* globals self */
'use strict';

var background = {
  send: self.port.emit,
  receive: self.port.on
};

var manifest = {
  url: self.options.base,
  locale: (id) => self.options.locales[id]
};

background.receive('show', function () {
  background.send('show');
});
