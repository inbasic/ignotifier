const decode = function(input) {
  let a;
  try {
    a = atob(input);
  }
  catch (e) {
    a = atob(input.replace(/-/g, '+').replace(/_/g, '/'));
  }

  return decodeURIComponent(escape(a));
};

window.onmessage = e => {
  const request = e.data;

  if (request.method === 'show-message') {
    document.querySelector('base').href = request.base;

    const message = request.message;
    const more = document.getElementById('more');
    /* subject */
    const subject = message?.headers?.Subject || message.payload.headers.filter(o => o.name === 'Subject').shift().value;
    if (subject) {
      const e = document.getElementById('subject');
      e.title = e.textContent = subject;
      e.href = request['user-href'];
    }
    /* labels */
    const t = document.getElementById('label');
    for (const label of (message.labelIds || message.tags)) {
      if (parent.HIDDENS.some(a => label.toLowerCase() === a)) {
        continue;
      }
      const clone = document.importNode(t.content, true);
      clone.querySelector('input').disabled = parent.DISABLED.some(a => label === a);
      clone.querySelector('span').textContent = label;
      clone.querySelector('input').onclick = e => {
        top.post({
          method: 'modify-a-message',
          message,
          removeLabelIds: [label]
        });
        e.target.parentElement.remove();
      };
      more.appendChild(clone);
    }
    /* from */
    const from = message?.headers?.From || message.payload.headers.filter(o => o.name === 'From').shift().value;
    if (from) {
      document.getElementById('from').textContent = from;
    }
    /* to */
    const to = message?.headers?.To || message.payload.headers.filter(o => o.name === 'To').shift().value;
    if (to) {
      document.getElementById('to').textContent = to;
    }
    /* content */
    let content;
    let mime;

    const parts = [];
    const attachments = [];
    if (message.body && Array.isArray(message.body)) { // notmuch
      const next = o => {
        if (o['content-type'].startsWith('multipart/')) {
          o.content.forEach(next);
        }
        else {
          parts.push(o);
        }
      };
      message.body.forEach(next);
      parts.forEach(o => {
        if (o['content-type'] !== 'text/plain' && o['content-type'] !== 'text/html') {
          attachments.push(o);
        }
      });
      const o = parts.filter(o => {
        if (request.mode === 'expanded') {
          return o['content-type'] === 'text/html';
        }
        return o['content-type'] === 'text/plain';
      }).shift() || parts[0];
      if (o) {
        mime = o['content-type'];
        content = o;
      }
    }
    else if (message.payload.parts) {
      const parts = [];
      const next = o => {
        if (o.mimeType && o.mimeType.startsWith('multipart/')) {
          o.parts.forEach(next);
        }
        else {
          parts.push(o);
        }
      };
      message.payload.parts.forEach(next);

      parts.forEach(o => {
        if (o.mimeType !== 'text/plain' && o.mimeType !== 'text/html') {
          attachments.push(o);
        }
      });
      const o = parts.filter(o => {
        if (request.mode === 'expanded') {
          return o.mimeType === 'text/html';
        }
        return o.mimeType === 'text/plain';
      }).shift();
      if (o) {
        mime = o.mimeType;
        content = o.body;
      }
    }
    if (!content) {
      content = message.payload.body;
      mime = message.payload.mimeType;
    }
    if (
      (mime === 'text/html' && request.mode === 'collapsed') ||
      (mime === 'text/plain' && request.com === 'snippet' && message.snippet)
    ) {
      content = {
        content: message.snippet
      };
      mime = 'text/plain';
    }
    const f = document.getElementById('content');
    if (request.csp) {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', 'Content-Security-Policy');
      meta.setAttribute('content', request.csp);
      f.contentDocument.head.appendChild(meta);
    }
    if (content) {
      if (content['raw-html']) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content['raw-html'], 'text/html');
        const bodies = doc.querySelectorAll('.maincontent > table tr:last-child td > div');

        content.content = '';
        for (const body of [...bodies].reverse()) {
          content.content += body.innerHTML + '<hr>';
        }
      }

      const body = content.content || decode(content.data || '');
      f.contentDocument.body.textContent = '';
      if (mime === 'text/html') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(body, 'text/html');
        const e = doc.querySelector('body');
        f.contentDocument.body.appendChild(e);
      }
      else if (body) {
        const pre = document.createElement('pre');
        pre.textContent = body;
        f.contentDocument.body.appendChild(pre);
      }
      const style = document.createElement('style');
      style.textContent = `
        body > hr {
          border: none;
          border-bottom: solid 4px whitesmoke;
        }
        body > hr:last-child {
          display: none;
        }
      `;
      f.contentDocument.head.appendChild(style);

      // prevent redirects
      for (const a of [...f.contentDocument.body.querySelectorAll('a[href^="https://www.google.com/url?"]')]) {
        const href = a.href;
        const args = new URLSearchParams(a.href.substr(27));
        if (args.has('q')) {
          const link = args.get('q');
          a.setAttribute('href', link || href);
        }
      }

      // resize observer
      const resizeObserver = new ResizeObserver(() => {
        f.style.height = f.contentDocument.documentElement.offsetHeight + 'px';
      });
      resizeObserver.observe(f.contentDocument.documentElement);
      // forward keyboards
      f.contentDocument.addEventListener('keydown', e => {
        top.document.dispatchEvent(new KeyboardEvent('keydown', e));
      });
    }
    // attachments
    if (attachments.length) {
      const a = document.getElementById('attachment');
      const e = document.getElementById('attachments');
      e.textContent = '';
      attachments.forEach(part => {
        const clone = document.importNode(a.content, true);

        clone.querySelector('span').onclick = e => chrome.permissions.request({
          permissions: ['downloads']
        }, granted => {
          if (granted) {
            const name = e.target.textContent;
            e.target.textContent = 'Downloading...';
            setTimeout(() => e.target.textContent = name, 1000);
            top.post({
              method: 'download-an-attachment',
              message,
              part
            });
          }
        });
        clone.querySelector('span').textContent = part.filename || `NA (${part['content-type'] || part.mimeType})`;
        e.appendChild(clone);
      });
    }
  }
};

// forward keyboards
document.addEventListener('keydown', e => {
  top.document.dispatchEvent(new KeyboardEvent('keydown', e));
});
