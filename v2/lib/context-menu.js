/* globals actions, config, open, checkEmails */
'use strict';

var contextmenu = {};

{
  const l10n = chrome.i18n.getMessage;
  const ids = {
    childs: []
  };
  ids.root = chrome.contextMenus.create({
    title: l10n('label_14'),
    contexts: ['browser_action'],
    enabled: false
  });
  ids.disable = chrome.contextMenus.create({
    title: l10n('label_3'),
    contexts: ['browser_action']
  });
  ids.silent = chrome.contextMenus.create({
    title: l10n('label_10'),
    type: 'checkbox',
    contexts: ['browser_action'],
    id: 'label_10',
    checked: true
  });

  chrome.contextMenus.create({
    title: l10n('label_11'),
    contexts: ['browser_action'],
    id: 'label_11'
  });
  chrome.contextMenus.create({
    title: l10n('label_1'),
    contexts: ['browser_action'],
    id: 'label_1'
  });
  chrome.contextMenus.create({
    title: l10n('label_12'),
    contexts: ['browser_action'],
    id: 'label_12'
  });

  ['label_4', 'label_5', 'label_6', 'label_7', 'label_8', 'label_9', 'label_13']
  .forEach(id => chrome.contextMenus.create({
    parentId: ids.disable,
    id,
    title: l10n(id),
    contexts: ['browser_action']
  }));

  chrome.contextMenus.onClicked.addListener(info => {
    const method = info.menuItemId;
    if (method === 'label_4') {
      actions.silent(300);
    }
    else if (method === 'label_5') {
      actions.silent(900);
    }
    else if (method === 'label_6') {
      actions.silent(1800);
    }
    else if (method === 'label_7') {
      actions.silent(3600);
    }
    else if (method === 'label_8') {
      actions.silent(7200);
    }
    else if (method === 'label_9') {
      actions.silent(18000);
    }
    else if (method === 'label_13') {
      actions.silent('custom');
    }
    else if (method === 'label_11') {
      open(config.email.compose);
    }
    else if (method === 'label_10') {
      config.notification.silent = !info.checked;
    }
    else if (method === 'label_1') {
      actions.reset();
    }
    else if (method === 'label_12') {
      open(chrome.runtime.getManifest().homepage_url);
    }
  });

  // public methods
  contextmenu.ids = ids;

  let cache = [];
  contextmenu.fireContext = () => {
    const accounts = (show => checkEmails.getCached().filter((e, i) => show[i]).map(o => ({
      title: o.xml.title,
      onclick: function(link) {
        if (link) {
          open(link.replace(/\?.*/, ''));
        }
      }.bind(this, o.xml.rootLink)
    })))(checkEmails.getCached().map(o => o.xml ? o.xml.rootLink : null)
    .filter(o => o)
    .map((e, i, a) => a.indexOf(e) === i));

    if (
      accounts.length === cache.length &&
      accounts.filter(a => cache.indexOf(a.title) !== -1).length === cache.length
    ) {
      return;
    }
    cache = accounts.map(a => a.title);
    ids.childs.forEach(o => chrome.contextMenus.remove(o.id));
    ids.childs = [];

    if (accounts.length === 1) {
      chrome.contextMenus.update(ids.root, accounts[0]);
    }
    else {
      chrome.contextMenus.update(ids.root, {
        title: l10n('label_14')
      }, () => {
        accounts.forEach(account => ids.childs.push({
          name: account.name,
          id: chrome.contextMenus.create(Object.assign({
            parentId: ids.root,
            contexts: ['browser_action'],
          }, account))
        }));
      });
    }
    chrome.contextMenus.update(ids.root, {
      enabled: accounts.length !== 0
    });
  };
}
