## [Gmail Notifier](https://add0n.com/gmail-notifier.html) browser extension (ignotifier)

### Description
[Gmail Notifier](https://add0n.com/gmail-notifier.html) is a multi-account notifier for Google mail (without storing passwords locally)

### YouTube Preview
[![YouTube Preview](https://img.youtube.com/vi/5Z2huN_GNkA/0.jpg)](https://www.youtube.com/watch?v=5Z2huN_GNkA)

### Listings (v3)

 * [Chrome Webstore](https://chrome.google.com/webstore/detail/gmail-notifier-developer/inglgcknnendooehdkhplbmhhbfkngmg)
 * [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/gmail-notifier-dev-edition/)
 * [Edge Addons](https://microsoftedge.microsoft.com/addons/detail/jhgfdokolagmnmjggpipkdefblhlhaap)

### Listings (v2)

 * [Chrome Webstore](https://chrome.google.com/webstore/detail/gmail-notifier/dcjichoefijpinlfnjghokpkojhlhkgl)
 * [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/gmail-notifier-restartless/)
 * [Edge Addons](https://microsoftedge.microsoft.com/addons/detail/cmhmeappbhdaifkknkhdnmogalbnhloa)
 * [Opera Addons](https://addons.opera.com/extensions/details/gmail-notifier/)

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
