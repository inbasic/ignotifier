/* global api, gmail, action, selected */
'use strict';

{
  const hiddens = ['STARRED', 'Inbox', 'INBOX'];

  let response;
  let root;
  let query;
  let inprogress = '';

  const star = url => {
    const id = gmail.get.id(url);

    const o = response.filter(o => o.thread === id).shift();
    if (o) {
      document.body.dataset.star = o.labels.some(s => s === 'STARRED');
    }
    else {
      document.body.dataset.star = 'hide';
    }
  };

  const labels = url => {
    return;
    const id = gmail.get.id(url);
    const o = response.filter(o => o.thread === id).shift();
    if (o) {
      const parent = document.getElementById('labels');
      const t = document.getElementById('label-template');
      parent.textContent = '';
      o.labels.map(s => s === '^i' ? 'Inbox' : s).filter(s => s.startsWith('^') === false && hiddens.indexOf(s) === -1).forEach(label => {
        const clone = document.importNode(t.content, true);
        clone.querySelector('span').textContent = label;
        clone.querySelector('div').dataset.value = label;
        parent.appendChild(clone);
      });

      document.body.dataset.labels = true;
    }
    else {
      document.body.dataset.labels = false;
    }
  };

  const update = (q = query, callback = () => {}) => chrome.runtime.sendMessage({
    method: 'gmail.search',
    url: selected.parent.xml.rootLink,
    query: q
  }, r => {
    if (!r || r instanceof Error) {
      console.error(r);
    }
    else {
      response = r;
      query = q;
      root = selected.parent.xml.rootLink;
      callback();
    }
  });

  const fetch = (url = selected.entry.link) => {
    document.body.dataset.labels = false;
    document.body.dataset.star = 'hide';

    const q = 'in:' + (selected.parent.xml.label || 'inbox') + ' is:unread';
    if (q === query && root === selected.parent.xml.rootLink && response) {
      star(url);
      labels(url);
    }
    else {
      if (inprogress === q) {
        console.info('update is rejected; duplicated');
      }
      else {
        inprogress = q;
        update(q, () => {
          inprogress = '';
          star(url);
          labels(url);
        });
      }
    }
  };

  api.on('update-full-content', fetch);

  document.getElementById('star').addEventListener('click', () => {
    const cmd = document.body.dataset.star === 'true' ? 'xst' : 'st';
    action(cmd, selected.entry.link, update);
    document.body.dataset.star = cmd === 'xst' ? 'false' : 'true';
  });
  document.getElementById('labels').addEventListener('click', ({target}) => {
    const cmd = target.dataset.cmd;
    if (cmd === 'remove-label') {
      const div = target.closest('div');
      const label = div.dataset.value;
      action('rc_' + label, selected.entry.link, update);
      div.remove();
    }
  });
}
