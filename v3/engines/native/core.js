/* global core */

const config = {
  id: 'com.add0n.node',
  path: '/usr/local/bin/notmuch',
  wsl: 'C:\\\\Windows\\\\System32\\\\wsl.exe',
  thread: {
    limit: 100
  }
};

class Engine {
  constructor(cnfg = {}) {
    this.TYPE = 'NATIVE';
    this.user = {};
    Object.assign(config, cnfg);
  }
  authorize() {
    return new Promise((resolve, reject) => chrome.permissions.contains({
      permissions: ['nativeMessaging']
    }, granted => {
      if (granted) {
        resolve();
      }
      else {
        reject(Error('User does not permit the native access'));
      }
    }));
  }
  exec(command, permissions = ['child_process', 'os']) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendNativeMessage(config.id, {
        permissions,
        args: [config.path, config.wsl, command],
        script: String.raw`
          const callback = (error, stdout, stderr) => {
            push({
              stdout,
              stderr: stderr || (error ? error.message : ''),
              code: (error || stderr) ? 1 : 0
            });
            close();
          }

          const cmd = require('os').platform() === 'win32' ?
            require('child_process').exec(args[1] + ' ' + args[0] + ' ' + args[2], callback) :
            require('child_process').exec(args[0] + ' ' + args[2], callback);

          cmd.stdout.on('data', stdout => push({
            stdout
          }));
          cmd.stderr.on('data', stderr => push({
            stderr
          }));
          cmd.stdin.end();
        `
      }, r => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(lastError);
        }
        else {
          resolve(r);
        }
      });
    });
  }
  spawn(commands, each = 'JSON.parse(stdout).forEach(push);', data = 'data => stdout += data', permissions = ['child_process', 'os']) {
    return new ReadableStream({
      start(controller) {
        const ch = chrome.runtime.connectNative(config.id);

        ch.onDisconnect.addListener(() => controller.error(Error('channel is broken')));
        ch.onMessage.addListener(r => {
          if (!r) {
            ch.disconnect();
            controller.error(Error('empty response'));
          }
          controller.enqueue(r);

          if (r.code === 0) {
            ch.disconnect();
            controller.close();
          }
          else if ('code' in r) {
            ch.disconnect();
            console.warn(r);
            controller.error(Error(r.error || 'code is not zero'));
          }
        });
        ch.postMessage({
          permissions,
          args: [config.path, config.wsl, commands],
          script: String.raw`
            const [command, query, limit, offset, output] = args;
            let notmuch;
            if (require('os').platform() === 'win32') {
              notmuch = require('child_process').spawn(args[1], ['notmuch', ...args[2]]);
            }
            else {
              notmuch = require('child_process').spawn(
                args[0],
                args[2]
              );
            }

            let stderr = '';
            let stdout = '';
            notmuch.stdout.on('data', ${data});
            notmuch.stderr.on('data', data => stderr += data);
            notmuch.on('close', code => {
              if (code === 0) {
                ${each}
                push({code: 0});
                close();
              }
              else {
                push({code, stdout, stderr});
                close();
              }
            });
            notmuch.stdin.end();
          `
        });
      }
    });
  }
  async introduce() {
    const r = await this.exec('config get user.name');
    if (r && r.stdout) {
      this.user.name = r.stdout.trim();

      return this.user.name;
    }
    else {
      throw Error(r?.stderr || 'cannot detect any user! is "notmuch" installed on this system');
    }
  }
  async threads(query) {
    const resultSizeEstimate = parseInt((await this.exec('count ' + query)).stdout);
    const readable = this.spawn(['search', '--limit=' + config.thread.limit, '--offset=0', '--format=json', '--output=summary', query]);

    return new Promise((resolve, reject) => {
      const threads = [];
      readable.pipeTo(new WritableStream({
        write(r) {
          if (r.thread) {
            threads.push({
              snippet: r.subject,
              id: r.thread,
              messages: {
                labelIds: r.tags.map(s => {
                  if (s === 'unread') {
                    return 'UNREAD';
                  }
                  else if (s === 'flagged') {
                    return 'STARRED';
                  }
                  return s;
                }),
                date: r.date_relative,
                payload: {
                  mimeType: 'multipart/alternative',
                  headers: [{
                    name: 'From',
                    value: r.authors
                  }]
                }
              }
            });
          }
        },
        close() {
          resolve({
            resultSizeEstimate,
            threads
          });
        },
        abort(e) {
          reject(e);
        }
      }));
    });
  }
  async thread(thread) {
    const readable = this.spawn([
      'show', '--entire-thread=true', '--body=true', '--include-html', '--format=json', 'thread:' + thread.id
    ], `const step = arr => arr.forEach(a => Array.isArray(a) ? step(a) : push(a)); step(JSON.parse(stdout));`);
    return new Promise((resolve, reject) => {
      const messages = [];
      readable.pipeTo(new WritableStream({
        write(r) {
          if (r.id) {
            messages.push(r);
          }
        },
        close() {
          resolve({
            messages
          });
        },
        abort(e) {
          reject(e);
        }
      }));
    });
  }
  async action(threads, name) {
    const addLabelIds = [];
    const removeLabelIds = [];
    if (name === 'delete') {
      addLabelIds.push('deleted');
    }
    if (name === 'mark-as-unread') {
      addLabelIds.push('unread');
    }
    if (name === 'mark-as-read') {
      removeLabelIds.push('unread');
    }
    if (name === 'archive') {
      addLabelIds.push('archive');
    }
    if (name === 'move-to-inbox') {
      addLabelIds.push('inbox');
    }
    if (name === 'report') {
      addLabelIds.push('spam');
    }
    if (name === 'add-star') {
      addLabelIds.push('flagged');
    }
    if (name === 'remove-star') {
      removeLabelIds.push('flagged');
    }

    const r = await this.exec('tag ' + [
      ...addLabelIds.map(s => '+' + s),
      ...removeLabelIds.map(s => '-' + s)
    ].join(' ') + ' ' + threads.map(th => 'thread:' + th.id).join(' '));

    return [r];
  }
  async attachment(message, part) {
    const readable = this.spawn(['show', '--part=' + part.id, '--format=raw', 'id:' + message.id], '', 'stdout => push(stdout)');
    return new Promise((resolve, reject) => {
      const data = [];

      readable.pipeTo(new WritableStream({
        write(r) {
          if (r.data) {
            data.push(r.data);
          }
        },
        close() {
          const bytes = new Uint8Array(data.flat());
          const blob = new Blob([bytes], {
            type: part['content-type']
          });
          const href = URL.createObjectURL(blob);

          core.download({
            filename: part.filename || 'unknown',
            url: href
          }).then(() => {
            URL.revokeObjectURL(href);
            resolve();
          });
        },
        abort(e) {
          reject(e);
        }
      }));
    });
  }
  async modify({message, addLabelIds = [], removeLabelIds = []}) {
    const r = await this.exec('tag ' + [
      ...addLabelIds.map(s => '+' + s),
      ...removeLabelIds.map(s => '-' + s)
    ].join(' ') + ' ' + 'id:' + message.id);

    return r;
  }
}

export default Engine;
