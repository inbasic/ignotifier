## [Gmail Notifier](http://add0n.com/gmail-notifier.html) multi-browser extension (ignotifier)

### Description
[Gmail Notifier](http://add0n.com/gmail-notifier.html) is a multi-account notifier for Google mail (without storing passwords locally)

![116888](https://cloud.githubusercontent.com/assets/351062/19102298/0a93ce12-8adc-11e6-9a35-b4e183de6c73.png)

### General information
To compile ignotifier project you need to have these softwares and libraries available:

 * [nodejs](http://nodejs.org/)
 * [Mozilla JPM](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/jpm)
 * [Gulp.JS](http://gulpjs.com/)

### Folders description
* compile: nodejs locale converter
* preview: screenshots
* src: ignotifier source code

### How to compile ignotifier
1. Open a new terminal in the root dir (directory contains src, preview, template, and compile folders)
2. Run `npm install` to acquire the necessary nodejs packages
3. Run `gulp firefox` or  `gulp chrome` to compile ignotifier in Firefox or Chrome browsers
   * After running `gulp firefox`, project gets compiled for Firefox browser. Compiled files will be located on `builds/unpacked/firefox` folder. An executable XPI will be placed in `builds/packed/firefox.xpi`
    * After running `gulp chrome`, project gets compiled for Chrome/Opera browser. Compiled files will be located on `builds/unpacked/chrome` folder. A zipped archive will be placed in `builds/packed/chrome.zip`
    * For `gulp firefox` to auto install the extension on your Firefox browser, you need to have [Extension Auto-Installer](https://addons.mozilla.org/en-US/firefox/addon/autoinstaller/) installed in your Firefox.
    * For `gulp chrome` to auto install the extension on your Chrome browser, you will need to modify [Line 65 of `gulp.js`](https://github.com/inbasic/ignotifier/blob/master/gulpfile.js#L65) to your Chrome executable (the current path is for Mac OS).

### How to translate ignotifier
* To translate ignotifier into your language head to [transifex.com](https://www.transifex.com/projects/p/gmail-notifier-addon) page.
* After the translation is ready, insert the translated file in `/src/_locales` directory
* For Firefox to recognize the translation, you will need to run the following commend in the root directory
`node compile/convert.js`
* Now compile the project as described above to have the localized version of ignotifier.

### How to try the precompiled latest version on Firefox
1. Select the right branch
2. Browse the `builds/packed` directory
3. Download the raw *.xpi file
4. Open a browser tab for `about:debugging` and turn on the developer mode
5. Point the browse button to the download XPI

### How to try the precompiled latest version on Chrome
1. Select the right branch
2. Browse the `builds/packed` directory
3. Download the *.zip file and extract it somewhere
4. Open a browser tab for `chrome://extensions` and turn on the developer mode
5. Point the browse button to the root directory
