/* globals api, gmail, action, selected */
'use strict';

{
  let doc;
  let root;
  let query;

  const getTr = id => {
    const a = [...doc.querySelectorAll('a')].filter(a => a.href.indexOf('th=' + id) !== -1).shift();
    if (a) {
      return a.closest('tr');
    }
  };

  function star(url) {
    const id = gmail.get.id(url);
    const tr = getTr(id);
    if (tr) {
      const img = tr.querySelector('td:first-child img');
      const star = img && img.src.indexOf('cleardot') === -1;
      document.body.dataset.star = Boolean(star);
    }
    else {
      document.body.dataset.star = 'hide';
    }
  }
  function labels(url) {
    const id = gmail.get.id(url);
    const tr = getTr(id);
    const parent = document.getElementById('labels');
    parent.textContent = '';
    if (tr) {
      const font = tr.querySelector('td:nth-child(3) font[color="#006633"]');
      if (font) {
        const labels = font.textContent.split(', ');
        if (labels.length) {
          const t = document.getElementById('label-template');
          labels.forEach(label => {
            const clone = document.importNode(t.content, true);
            clone.querySelector('span').textContent = label;
            clone.querySelector('div').dataset.value = label;
            parent.appendChild(clone);
          });

          document.body.dataset.labels = true;
          return;
        }
      }
    }
    document.body.dataset.labels = false;
  }

  const update = (q = query, callback = () => {}) => chrome.runtime.sendMessage({
    method: 'gmail.search',
    url: selected.parent.xml.rootLink,
    query: q
  }, response => {
    if (response) {
      root = selected.parent.xml.rootLink;
      query = q;
      const parser = new DOMParser();
      doc = parser.parseFromString(response, 'text/html');
      callback();
    }
  });
  let inprogress = '';
  function fetch(url = selected.entry.link) {
    document.body.dataset.labels = false;
    document.body.dataset.star = 'hide';

    const q = 'in:' + (selected.parent.xml.label || 'inbox') + ' is:unread';
    if (q === query && root === selected.parent.xml.rootLink && doc) {
      star(url);
      labels(url);
    }
    else {
      if (inprogress === q) {
        console.log('update is rejected; duplicated');
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
  }

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
