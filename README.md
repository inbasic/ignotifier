#Gmail Notifier (ignotifier)
Multi-account Gmail notifier (without storing passwords locally)

###General information
To compile ignotifier project you need to have these softwares installed:
* [python](http://www.python.org/getit/)
* [nodejs](http://nodejs.org/)

Folders description:
* src: ignotifier source code
* compile: nodejs auto-compiler
* ../addon-sdk-*: latest version of [Mozilla addon-sdk](https://addons.mozilla.org/en-US/developers/builder).
* preview: screenshots
* template: bootstrap folder

###How to compile ignotifier
1. Open a new terminal in the root dir (directory contains src, addon-sdk-*, preview, and compile folders)
2. Run "node compile\install.js" to run ignotifier in a new Firefox profile. To make xpi run "node compile\install.js --xpi". For more options use "--help"

###How to try precompiled latest version
1. Browse the src directory
2. Download the raw *.xpi file
3. Drag and drop it into Firefox
