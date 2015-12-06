'use strict';

var gulp = require('gulp');
var change = require('gulp-change');
var babel = require('gulp-babel');
var gulpif = require('gulp-if');
var gulpFilter = require('gulp-filter');
var shell = require('gulp-shell');
var wait = require('gulp-wait');
var clean = require('gulp-clean');
var zip = require('gulp-zip');
var rename = require('gulp-rename');
var util = require('gulp-util');
var runSequence = require('run-sequence');

/* clean */
gulp.task('clean', function () {
  return gulp.src([
    'builds/unpacked/chrome/*',
    'builds/unpacked/firefox/*',
  ], {read: false})
    .pipe(clean());
});
/* chrome build */
gulp.task('chrome-build', function () {
  gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.indexOf('.DS_Store') !== -1 || f.relative.indexOf('Thumbs.db') !== -1) {
      return false;
    }
    if (f.relative.indexOf('firefox') !== -1 && f.relative.indexOf('firefox.png') === -1) {
      return false;
    }
    if (f.path.indexOf('/locale') !== -1) {
      return false;
    }
    if (f.relative.indexOf('safari') !== -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return f.relative === 'manifest.json' ? true : false;
    }
    return true;
  }))
  .pipe(gulpif(function (f) {
    return f.path.indexOf('.js') !== -1 && f.path.indexOf('.json') === -1;
  }, change(function (content) {
    return content.replace(/\/\*\* wrapper[\s\S]*\\*\*\*\//m, '');
  })))
  .pipe(gulpif(function (f) {
    return f.path.indexOf('.html') !== -1;
  }, change(function (content) {
    return content.replace(/.*shadow_index\.js.*/, '    <script src="chrome/chrome.js"></script>\n    <script src="index.js"></script>');
  })))
  .pipe(gulp.dest('builds/unpacked/chrome'))
  .pipe(zip('chrome.zip'))
  .pipe(gulp.dest('builds/packed'));
});
gulp.task('chrome-install', function () {
  gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --load-and-launch-app=`pwd` &'
  ], {
    cwd: './builds/unpacked/chrome'
  }));
});

/* firefox build */
gulp.task('firefox-build', function () {
  gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.indexOf('.DS_Store') !== -1 || f.relative.indexOf('Thumbs.db') !== -1) {
      return false;
    }
    if (f.path.indexOf('_locales') !== -1) {
      return false;
    }
    if (f.relative.indexOf('chrome') !== -1 &&
      f.relative !== 'chrome.manifest' &&
      f.relative.indexOf('chrome.png') === -1 &&
      f.relative.indexOf('firefox/chrome') === -1
    ) {
      return false;
    }
    if (f.relative.indexOf('shadow_index.js') !== -1) {
      return false;
    }
    if (f.relative.indexOf('safari') !== -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return ['package.json', 'chrome.manifest'].indexOf(f.relative) !== -1;
    }
    return true;
  }))
  .pipe(gulpif(function (f) {
    return f.path.indexOf('.html') !== -1;
  }, change(function (content) {
    return content.replace(/\n.*shadow_index\.js.*/, '');
  })))
  .pipe(gulp.dest('builds/unpacked/firefox'));
});
/* firefox pack */
gulp.task('firefox-pack', function () {
  gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    'jpm xpi',
    'mv *.xpi ../../packed/firefox.xpi',
    'jpm post --post-url http://localhost:8888/'
  ], {
    cwd: './builds/unpacked/firefox'
  }))
  .pipe(shell([
    'zip firefox.xpi install.rdf icon.png icon64.png',
  ], {
    cwd: './builds/packed'
  }));
});
/* */
gulp.task('chrome', function (callback) {
  runSequence('clean', 'chrome-build', 'chrome-install', callback);
});
gulp.task('firefox', function (callback) {
  runSequence('clean', 'firefox-build', 'firefox-pack', callback);
});
