/* global sax */

const query = (code, query, stop = true) => {
  return new Promise((resolve, reject) => {
    const results = [];
    let tree;

    const validate = () => {
      if ((query.name ? query.name === tree.name : true) && (query.match ? query.match(tree) : true)) {
        results.push(tree);
        if (stop) {
          resolve(tree);
          throw Error('done');
        }
      }
    };

    class Node {
      constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
        this.children = [];
      }
      closest(name) {
        let p = this.parent;
        while (p && p.name !== name) {
          p = p.parent;
        }
        return p;
      }
      child(query, reverse = false, stop = true) {
        const matches = [];
        const once = node => {
          if (node.children) {
            for (const n of (reverse ? [...node.children].reverse() : node.children)) {
              if ((query.name ? query.name === n.name : true) && (query.match ? query.match(n) : true)) {
                return n;
              }
              const r = once(n);
              if (r && stop) {
                return r;
              }
              else if (r) {
                matches.push(r);
              }
            }
          }
        };
        const r = once(this);
        return stop ? r : matches;
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
      validate();
      if (name === tree.name) {
        if (tree.parent) {
          tree = tree.parent;
        }
      }
    };
    parser.ontext = text => tree.text = text;
    parser.onend = () => {
      resolve(results);
    };
    parser.onerror = e => reject(e);
    parser.write(code).end();
  });
};
