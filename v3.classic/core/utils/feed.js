/* global sax */
self.importScripts('/core/utils/sax.js');

const convert = code => {
  return new Promise((resolve, reject) => {
    let tree;

    class Node {
      constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
        this.children = [];
      }
    }

    const parser = sax.parser(false);
    parser.onopentag = function(node) {
      const child = new Node(node.name, node.attributes);

      if (!tree) {
        tree = child;
      }
      else {
        child.parent = tree;
        tree.children.push(child);
        tree = child;
      }
    };

    parser.onclosetag = function(name) {
      if (name === tree.name) {
        if (tree.parent) {
          tree = tree.parent;
        }
      }
    };
    parser.ontext = text => tree.text = text;
    parser.onend = () => {
      resolve(tree);
    };
    parser.onerror = e => reject(e);
    parser.write(code).end();
  });
};

class Feed {
  #timeout;
  #isPrivate;
  constructor(feed, timeout, isPrivate) {
    this.href = feed;
    this.#timeout = timeout;
    this.#isPrivate = isPrivate;
  }
  execute(signal, duplicated = () => false) {
    const isPrivate = this.#isPrivate;

    // Sometimes id is wrong in the feed structure!
    const fixID = link => {
      const id = /u\/\d+/.exec(this.href);
      if (id && id.length) {
        return link.replace(/u\/\d+/, id[0]);
      }
      return link;
    };
    const controller = new AbortController();
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      signal: controller.signal
    });
    const id = setTimeout(() => controller.abort('TIMEOUT'), this.#timeout);
    const href = this.href + '?rand=' + Math.round(Math.random() * 10000000);
    return fetch(href, {
      method: 'GET',
      cache: 'no-store',
      signal
    }).then(async r => {
      if (!r.ok) {
        clearTimeout(id);
        return {
          isPrivate,
          network: r.status !== 0,
          notAuthorized: r.status === 401,
          xml: null,
          newIDs: []
        };
      }
      if (r.url.includes('/u/0/') && this.href.includes('/u/0/') === false) {
        clearTimeout(id);
        return {
          isPrivate,
          network: r.status !== 0,
          notAuthorized: true,
          xml: null,
          newIDs: []
        };
      }

      const content = await r.text();
      clearTimeout(id);
      // global id
      const uid = (content.split('<title>')[1] || '').split('</title>')[0];
      if (uid) {
        if (duplicated(uid)) {
          return {
            isPrivate,
            network: r.status !== 0,
            notAuthorized: true,
            xml: null,
            newIDs: []
          };
        }
      }
      //
      const tree = await convert(content);

      const xml = {
        get fullcount() {
          let one = 0;
          for (const node of tree.children) {
            if (node.name === 'FULLCOUNT') {
              one = Number(node.text);
              break;
            }
          }
          const two = tree.children.filter(o => o.name === 'ENTRY').length;

          return Math.max(one, two);
        },
        get id() {
          return uid;
        },
        get title() {
          let title = '';
          for (const node of tree.children) {
            if (node.name === 'TITLE') {
              title = node.text;
              break;
            }
          }
          try {
            return title.match(/[^ ]+@.+\.[^ ]+/)[0];
          }
          catch (e) {
            return title;
          }
        },
        get label() {
          for (const node of tree.children) {
            if (node.name === 'TAGLINE') {
              const match = node.text.match(/'(.*)' label/);
              if (match && match.length == 2) {
                return match[1];
              }
            }
          }
          return '';
        },
        get link() {
          let temp = this.rootLink;
          const label = this.label;
          if (label) {
            temp += '/?shva=1#label/' + label;
          }
          // account selector uses this url as account identifier
          if (isPrivate) {
            temp += '@private';
          }
          return temp;
        },
        get rootLink() {
          let temp = 'https://mail.google.com/mail/u/0';
          // Inbox href
          for (const node of tree.children) {
            if (node.name === 'LINK') {
              temp = node.attributes?.HREF;
              break;
            }
          }
          temp = temp.replace('http://', 'https://');
          return fixID(temp);
        },
        get authorized() {
          for (const node of tree.children) {
            if (node.name === 'TITLE') {
              return true;
            }
          }
          return false;
        },
        get entries() {
          return tree.children.filter(o => o.name === 'ENTRY').map(node => {
            const o = {};
            for (const c of node.children) {
              if (c.name === 'TITLE') {
                o.title = c.text;
              }
              else if (c.name === 'SUMMARY') {
                o.summary = c.text;
              }
              else if (c.name === 'MODIFIED') {
                o.modified = c.text;
              }
              else if (c.name === 'ISSUED') {
                o.issued = c.text;
              }
              else if (c.name === 'ID') {
                o.id = c.text;
              }
              else if (c.name === 'LINK') {
                o.link = fixID((c.attributes.HREF || '').replace('http://', 'https://'));
              }
              else if (c.name === 'AUTHOR') {
                for (const nn of c.children) {
                  if (nn.name === 'NAME') {
                    o['author_name'] = nn.text;
                  }
                  else if (nn.name === 'EMAIL') {
                    o['author_email'] = nn.text;
                  }
                }
              }
            }
            o['author_name'] = o['author_name'] || chrome.i18n.getMessage('msg_1');
            o['author_email'] = o['author_email'] || '';
            o.title = o.title || '';
            o.summary = o.summary || '';

            return o;
          });
        }
      };
      const key = 'ids.account.' + xml.title;
      return new Promise(resolve => {
        chrome.storage.local.get({
          [key]: [],
          'threatAsNew': 10 // minutes
        }, prefs => {
          const newIDs = [];
          const oldIDs = [];
          const now = Date.now();
          for (const {id, modified} of xml.entries) {
            const age = (now - (new Date(modified)).getTime());
            if (age > 1000 * 60 * prefs.threatAsNew) {
              oldIDs.push(id);
            }
            else if (prefs[key].includes(id)) {
              oldIDs.push(id);
            }
            else {
              newIDs.push(id);
            }
          }
          resolve({
            isPrivate,
            network: true,
            notAuthorized: xml.authorized === false,
            xml,
            newIDs,
            // we postpone the save of new ids to make sure the request is not being aborted
            commit() {
              if (newIDs.length) {
                chrome.storage.local.set({
                  [key]: [
                    ...oldIDs,
                    ...newIDs
                  ]
                });
              }
            }
          });
        });
      });
    }).catch(e => {
      clearTimeout(id);
      throw e;
    });
  }
}
