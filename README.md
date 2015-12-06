##Gmail Notifier multi-browser extension(ignotifier)
### Description
[Gmail Notifier](http://add0n.com/gmail-notifier.html) is a multi-account notifier for Google mail (without storing passwords locally)

###General information
To compile ignotifier project you need to have these softwares and libraries available:

 * [python](http://www.python.org/getit/)
 * [nodejs](http://nodejs.org/)
 * [Mozilla addon-sdk](https://addons.mozilla.org/en-US/developers/builder)


> By default, the addon-sdk folder is assumed to be one directory above the project. This can be modified using the ``--sdk`` parameter.

###Folders description
* compile: nodejs auto-compiler
* preview: screenshots
* src: ignotifier source code
* template: bootstrap folder

###How to compile ignotifier
1. Open a new terminal in the root dir (directory contains src, preview, template, and compile folders)
2. Run ``npm install`` to acquire the necessary nodejs packages
3. Run ``node compile/install.js`` to run ignotifier in a new Firefox profile
   To make the xpi run ``node compile/install.js --xpi``
   For more options use ``node compile/install.js --help``

###How to translate ignotifier
* To translate ignotifier into your language head to [transifex.com](https://www.transifex.com/projects/p/gmail-notifier-addon) page.
* After the translation is ready, insert the translated file in `/src.safariextension/_locales` folder
* For Firefox to recognize the translation, you need to run the following commend in the root directory
`node compile/convert.js`
* Now compile the project as described above to have the localized version of ignotifier.

###How to try the precompiled latest version
1. Select the right branch
2. Browse the src directory
3. Download the raw *.xpi file
4. Drag and drop it into Firefox
