/* global core, post, active, moment, CONFIGS */

const api = {};

const scrollIntoView = e => {
  const out = () => {
    const rect = e.getBoundingClientRect();
    if (rect.bottom < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight) {
      return true;
    }
    const d = document.elementFromPoint(rect.left, rect.top);
    return e.contains(d) === false;
  };
  if (out()) {
    e.scrollIntoView();
  }
};

/* api.dom */
api.dom = {
  entries(selected = false) {
    if (selected) {
      return [...document.querySelectorAll('#entries input:checked')];
    }
    return [...document.querySelectorAll('#entries input')];
  },
  entry(selected) {
    return document.querySelector('#entries input' + (selected ? ':checked' : ''));
  }
};

/* api.navigate */
api.navigate = direction => {
  const inputs = api.dom.entries(true);
  if (inputs.length) {
    const input = direction === 'next' ? inputs[inputs.length - 1] : inputs[0];
    const li = input.closest('li');
    const d = direction === 'next' ? li.nextElementSibling : li.previousElementSibling;
    if (d) {
      d.querySelector('input').dispatchEvent(new CustomEvent('click', {
        detail: {
          'consider-trusted': true
        },
        bubbles: true
      }));
      d.querySelector('input').click();
      return scrollIntoView(d);
    }
  }
  const input = api.dom.entry();
  if (input) {
    input.click();
    scrollIntoView(input.closest('li'));
  }
};

/* api.view */
{
  const content = document.getElementById('content');
  api.view = {
    clear() {
      content.textContent = '';
    },
    async display(threads) {
      content.classList.add('loading');
      api.view.clear();
      let n = 0;
      for (const thread of threads) {
        const h2 = document.createElement('h2');
        h2.textContent = core.i18n.get('pp_next_thread');
        h2.classList.add('next-thread');
        content.appendChild(h2);

        const {messages, error} = await post({
          method: 'read-a-thread',
          thread
        });
        const prefs = await core.storage.read({
          'popup-csp': CONFIGS['popup-csp'],
          'popup-collapsed-message': CONFIGS['popup-collapsed-message']
        });
        if (error) {
          console.warn(error);
          return alert(error.message || error);
        }
        for (const message of messages.reverse()) {
          const iframe = document.createElement('iframe');
          iframe.src = 'view/view.html';
          const index = n;
          iframe.onload = () => {
            // resize observer
            const resizeObserver = new ResizeObserver(() => {
              if (iframe.contentDocument) {
                iframe.style.height = iframe.contentDocument.documentElement.scrollHeight + 'px';
              }
            });
            resizeObserver.observe(iframe.contentDocument.documentElement);
            // show message
            iframe.contentWindow.postMessage({
              mode: document.body.classList.contains('collapsed') ? 'collapsed' : 'expanded',
              com: prefs['popup-collapsed-message'],
              method: 'show-message',
              message,
              index,
              csp: prefs['popup-csp']
            }, '*');
          };
          content.appendChild(iframe);
          n += 1;
        }
      }
      content.classList.remove('loading');
    }
  };
}

/* api.users */
{
  const e = document.getElementById('user');
  api.users = {
    clear() {
      e.textContent = '';
    },
    async build() {
      const prefs = await core.storage.read({
        'popup-account': CONFIGS['popup-account'],
        'popup-switch-to-unread-user': CONFIGS['popup-switch-to-unread-user']
      });
      Object.keys(active.users).forEach(user => {
        const option = document.createElement('option');
        option.value = option.textContent = user;
        option.selected = prefs['popup-account'].user === user;
        e.appendChild(option);
      });
      // what if the user does not have new email
      if (prefs['popup-switch-to-unread-user']) {
        if (Object.values(active.users[active.user].queries || {}).some(o => o.resultSizeEstimate) === false) {
          for (const [user, o] of Object.entries(active.users)) {
            if (Object.values(o.queries || {}).some(o => o.resultSizeEstimate)) {
              e.value = user;
              break;
            }
          }
        }
      }
      e.dispatchEvent(new Event('change'));
    },
    async queries() {
      const prefs = await core.storage.read({
        'queries': CONFIGS['queries'],
        'default-queries': CONFIGS['default-queries']
      });
      let qs = prefs['default-queries'];
      if (prefs.queries[active.user]) {
        qs = prefs.queries[active.user];
      }
      return qs;
    }
  };
}

/* api.query */
{
  const e = document.getElementById('search');
  const history = document.getElementById('history');
  api.query = {
    async build() {
      api.query.clear();

      const prefs = await core.storage.read({
        'popup-switch-to-unread-query': CONFIGS['popup-switch-to-unread-query'],
        'popup-account': CONFIGS['popup-account'],
        'default-queries': CONFIGS['default-queries']
      });

      const queries = active.users[active.user]?.queries || {};
      for (const query of Object.keys(queries)) {
        const option = document.createElement('option');
        option.textContent = option.value = query;
        history.appendChild(option);
      }
      if (prefs['popup-account'].user === active.user) {
        e.value = prefs['popup-account'].query;
      }
      if (e.value === '') {
        e.value = prefs['default-queries'][0];
      }
      // what is the active query does not have emails
      if (prefs['popup-switch-to-unread-query']) {
        // what id a custom query is searched which needs to be fetched
        if (queries[active.query] && !queries[active.query]?.resultSizeEstimate) {
          for (const [query, o] of Object.entries(queries)) {
            if (o.resultSizeEstimate) {
              e.value = query;
              break;
            }
          }
        }
      }
      e.dispatchEvent(new Event('search'));
    },
    clear() {
      history.textContent = '';
      e.value = '';
    }
  };
}

/* api.entries */
{
  const entries = document.getElementById('entries');
  const t = document.getElementById('t-entry');
  api.entries = {
    clear() {
      entries.textContent = '';
      document.getElementById('total').textContent = '-';
      document.title = active.user + '- Gmail Notifier';
    },
    async build(threads = [], e) {
      api.entries.clear();
      document.getElementById('total').textContent = threads.length;
      document.title = active.user + ` (${threads.length}) - Gmail Notifier`;

      const prefs = await core.storage.read({
        'popup-account': CONFIGS['popup-account']
      });

      for (const thread of threads) {
        if (thread.messages.error) {
          console.warn('ignoring a thread', thread);
          continue;
        }
        const clone = document.importNode(t.content, true);
        const input = clone.querySelector('input');
        input.thread = thread;
        input.dataset.thread = thread.id;

        input.dataset.read = thread.messages.labelIds.indexOf('UNREAD') === -1;
        input.dataset.star = thread.messages.labelIds.indexOf('STARRED') !== -1;

        if (thread.messages.date) {
          clone.querySelector('[data-id=date]').textContent = thread.messages.date;
        }
        else {
          const date = moment(parseInt(thread.messages.internalDate));
          clone.querySelector('[data-id=date]').textContent = date.fromNow();
        }

        const sender = thread.messages.payload.headers.filter(a => a.name === 'From').shift();
        clone.querySelector('[data-id=sender]').title =
        clone.querySelector('[data-id=sender]').textContent = sender ? sender.value : '';

        clone.querySelector('[data-id=snippet]').title =
        clone.querySelector('[data-id=snippet]').textContent = thread.snippet || '';

        for (const name of thread.messages.labelIds) {
          if ([...window.HIDDENS, ...window.DISABLED].some(s => s === name.toLowerCase())) {
            continue;
          }
          const span = document.createElement('span');
          span.classList.add('tag');
          span.textContent = name;
          clone.querySelector('[data-id=tags]').appendChild(span);
        }

        entries.appendChild(clone);
      }
      let ids = [];
      if (prefs['popup-account'].user === active.user && prefs['popup-account'].query === active.query) {
        ids = prefs['popup-account'].threads;
      }
      // select threads
      for (const id of ids) {
        entries.querySelector(`input[data-thread="${id}"]`)?.click();
      }
      // select the first thread if no thread is selected
      if (api.dom.entry(true) === null) {
        api.dom.entry()?.click();
      }
      // scroll into view
      const input = api.dom.entry(true);
      if (input) {
        scrollIntoView(input.closest('li'));
      }
      else {
        api.update.buttons();
      }
    },
    remove(li) {
      li.remove();
      const total = api.dom.entries().length;
      document.getElementById('total').textContent = total;
      document.title = active.user + ` (${total}) - Gmail Notifier`;
    }
  };
}

api.update = {
  stat() {
    const lis = api.dom.entries().map(e => e.closest('li'));
    const r = {
      total: lis.length
    };

    const input = api.dom.entry(true);
    const li = input?.closest('li');
    r.current = li ? lis.indexOf(li) : -1;
    r.read = input?.dataset.read === 'true';

    return r;
  }
};
/* update notification */
{
  const sound = document.getElementById('sound');
  api.update.notification = async () => {
    const queries = await api.users.queries();

    sound.classList[queries.indexOf(active.query) === -1 ? 'remove' : 'add']('active');
  };
}
/* update current */
api.update.buttons = () => {
  const {current, total, read} = api.update.stat();
  document.getElementById('current').textContent = current === -1 ? 0 : (current + 1);

  document.getElementById('previous').disabled = current === -1 ? true : (current === 0);
  document.getElementById('next').disabled = current === -1 ? true : (current === total - 1);

  document.getElementById('sound').disabled = active.user === '';

  document.getElementById('archive').disabled =
  document.getElementById('delete').disabled =
  document.getElementById('report').disabled =
  document.getElementById('mark-as-read').disabled =
  document.getElementById('mark-all-as-read').disabled = current === -1;

  document.getElementById('inbox').disabled = !active.users[active.user].href;

  document.getElementById('mark-as-read').value = core.i18n.get(read ? 'pp_mark_as_unread' : 'pp_mark_as_read');
  document.getElementById('mark-as-read').dataset.command = read ? 'mark-as-unread' : 'mark-as-read';
};
