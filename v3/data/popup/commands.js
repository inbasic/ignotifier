/* global post, core, api, active */

const command = async (e, name, isTrusted = false) => {
  let es;
  if (name === 'add-star' || name === 'remove-star') {
    const li = e.target.closest('li');
    es = [{
      thread: li.querySelector('input').thread,
      li
    }];
  }
  else {
    es = api.dom.entries(true).map(e => ({
      thread: e.thread,
      li: e.closest('li')
    }));
  }
  if (es.length) {
    e.target.disabled = true;
    e.target.classList.add('loading');

    for (const act of command.map[name]) {
      if (act === 'post') {
        const r = await post({
          method: 'run-a-command',
          name,
          threads: es.map(e => e.thread)
        });
        const o = r ? r.filter(o => o.error).shift() : false;
        if (o) {
          console.warn(o);
          return alert(core.i18n.get('pp_action_failed') + '\n\n' + o.error.message);
        }
      }
      else if (act === 'next') { // only move to next on a user action
        if (isTrusted) {
          document.getElementById('next').click();
        }
      }
      else if (act === 'update') {
        const ni = api.dom.entry(true);

        es.map(({li}) => li.querySelector('input')).forEach(input => {
          if (name === 'mark-as-unread') {
            input.dataset.read = false;
            // remove label
            const n = input.thread.messages.labelIds.indexOf('UNREAD');
            if (n === -1) {
              input.thread.messages.labelIds.push('UNREAD');
            }
          }
          else {
            input.dataset.read = true;
            // remove label
            const n = input.thread.messages.labelIds.indexOf('UNREAD');
            if (n !== -1) {
              input.thread.messages.labelIds.splice(n, 1);
            }
          }
          // if navigation to next failed, update button states
          if (ni === input) {
            api.update.buttons();
          }
        });
      }
      else if (act === 'remove') {
        es.map(({li}) => api.entries.remove(li));
      }
    }

    e.target.disabled = false;
    e.target.classList.remove('loading');
  }
  else {
    alert('select a thread and retry');
  }
};
command.map = {
  'mark-as-read': ['post', 'next', 'update'],
  'mark-as-unread': ['post', 'next', 'update'],
  'mark-all-as-read': ['post', 'next', 'update'],
  'archive': ['post', 'next', 'remove'],
  'delete': ['post', 'next', 'remove'],
  'report': ['post', 'next', 'remove'],
  'add-star': ['post'],
  'remove-star': ['post']
};

document.getElementById('options').onclick = () => core.page.options();
document.getElementById('archive').onclick = e => command(e, 'archive', true);
document.getElementById('delete').onclick = e => command(e, 'delete', true);
document.getElementById('report').onclick = e => command(e, 'report', true);
document.getElementById('mark-as-read').onclick = e => command(e, e.target.dataset.command, true);
document.getElementById('mark-all-as-read').onclick = async e => {
  const threads = api.dom.entries().map(e => e.thread);
  if (threads.length) {
    e.target.disabled = true;
    e.target.classList.add('loading');
    await post({
      method: 'run-a-command',
      name: 'mark-as-read',
      threads
    });
    location.reload();
  }
};
document.getElementById('inbox').onclick = () => core.page.open({
  url: active.users[active.user].href
});
document.getElementById('refresh').onclick = async e => {
  e.target.disabled = true;
  e.target.classList.add('loading');
  await post({
    method: 'hard-refresh'
  });
  location.reload();
};
{
  const s = document.getElementById('search');
  document.addEventListener('keydown', e => {
    if (e.target === s) {
      return;
    }
    if (e.code === 'KeyJ') {
      document.getElementById('previous').click();
    }
    else if (e.code === 'KeyK') {
      document.getElementById('next').click();
    }
    else if (e.code === 'KeyE') {
      document.getElementById('archive').click();
    }
    else if (e.code === 'KeyI' && e.shiftKey) {
      const input = document.getElementById('mark-as-read');
      if (input.dataset.command === 'mark-as-read') {
        input.click();
      }
    }
    else if (e.code === 'KeyU' && e.shiftKey) {
      const input = document.getElementById('mark-as-read');
      if (input.dataset.command === 'mark-as-unread') {
        input.click();
      }
    }
    else if (e.key === '#') {
      document.getElementById('delete').click();
    }
    else if (e.key === '!') {
      document.getElementById('report').click();
    }
  });
}
