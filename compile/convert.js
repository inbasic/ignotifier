'use strict';

var fs = require('fs'),
    program = require('commander');

program
  .option('-i, --input <input locale file>')
  .option('-o, --output <input locale file>')
  .parse(process.argv);

fs.readFile(program.input, 'utf8', function (err, data) {
  if (err) {
    throw err;
  }
  var json = JSON.parse(data);
  var c = '';
  for (var name in json) {
    c += name + '=' + json[name].message + '\n';
  }
  fs.writeFile(program.output, c, 'utf8', function (err) {
    if (err) {
      throw err;
    }
    else {
      console.log('done');
    }
  });
});
