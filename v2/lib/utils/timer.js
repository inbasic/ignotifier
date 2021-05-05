'use strict';

var timer = {};

/** Repeater: Repeats a function infinity with an interval pattern
 *  Example:
 *  var repeater = new repeater(1000, 10000, 2000);
 *  var i = 0;
 *  repeater.on(function() {
 *    i += 1;
 *    console.error(i);
 *    if (i == 6) {
 *      repeater.reset();
 *    }
 *    if (i == 10) {
 *      repeater.stop();
 *    }
 *  });
 **/
timer.Repeater = function() {
  let id, callback;
  let intervals = [].slice.call(arguments, 0);
  function stop() {
    if (id) {
      window.clearTimeout(id);
    }
  }
  function run() {
    const t = intervals.length > 1 ? intervals.shift() : intervals[0];
    stop();
    id = window.setTimeout(function(args) {
      run();
      try {
        callback.apply(null, args);
      }
      catch (e) {}
    }, t, arguments);
  }

  return {
    reset: function() {
      stop();
      intervals.unshift(0);
      run.apply(null, arguments);
    },
    stop: stop,
    on: function(c) {
      callback = c;
      run();
    },
    fill: function() {
      intervals = [].slice.call(arguments, 0);
    }
  };
};
