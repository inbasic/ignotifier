'use strict';

var fs = require('fs');

function convert (input, output) {

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
        fs.writeFile('src/locale/' + output + '.properties', c, 'utf8', function (err) {
          if (err) {
            throw err;
          }
          else {
            console.log('[done]', input + '/messages.json');
          }
        });
      });
    }
    else {
      console.error('[error]', 'Cannot locate', input + '/messages.json');
    }
  });
}

convert('en', 'en');
convert('el', 'el');
convert('hu', 'hu');
convert('he', 'he');
convert('nl', 'nl');
convert('pl', 'pl');
convert('ru', 'ru');
convert('zh_CN', 'zh-CN');
