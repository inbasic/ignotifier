'use strict';

var fs = require('fs');
var path = require('path');

function convert (input, outputs) {

  fs.exists('src/_locales/' + input + '/messages.json', function (exists) {
    if (exists) {
      fs.readFile('src/_locales/' + input + '/messages.json', 'utf8', function (err, data) {
        if (err) {
          throw err;
        }
        var json = JSON.parse(data);
        var c = '';
        for (var name in json) {
          c += name + '=' + json[name].message + '\n';
        }
        outputs.forEach(function (output) {
          fs.writeFile('src/locale/' + output + '.properties', c, 'utf8', function (err) {
            if (err) {
              throw err;
            }
            else {
              console.log('[done]', input + '/messages.json', 'src/locale/' + output + '.properties');
            }
          });
        });
      });
    }
    else {
      console.error('[error]', 'Cannot locate', input + '/messages.json');
    }
  });
}

function map (input) {
  if (input === 'en') {
    return ['en', 'en-US'];
  }
  if (input === 'ru') {
    return ['ru', 'ru-RU'];
  }
  return [input.replace('_', '-')];
}

fs.readdir('src/locale', function (err, files) {
  console.error(err);
  files.forEach(function (file) {
    fs.unlinkSync(path.resolve('src/locale', file));
  });
  fs.readdir('src/_locales/', function (err, files) {
    files.filter(f => !f.startsWith('.')).forEach(function (file) {
      convert (file, map(file));
    });
  });
});

