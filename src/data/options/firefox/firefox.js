/* globals self */
'use strict';

var background = {
  send: function (id, data) {
    self.port.emit(id, data);
  },
  receive: function (id, callback) {
    self.port.on(id, callback);
  }
};

background.receive('show', function () {
  background.send('show');
});
