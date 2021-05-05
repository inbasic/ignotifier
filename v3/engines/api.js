/* global core, CONFIGS */

const config = {
  'base': 'https://www.googleapis.com/gmail/v1/',
  'auth': 'https://accounts.google.com/o/oauth2/auth',
  'scopes': ['https://www.googleapis.com/auth/gmail.modify'].join(', ')
};

class Engine {
  constructor(cnfg = {}) {
    this.TYPE = 'API';
    this.user = {};
    Object.assign(config, cnfg);
  }
  async authorize(cache = true, interactive = true) {
    const prefs = await core.storage.read({
      'api-client': CONFIGS['api-client']
    });

    if (prefs['api-client'] === '') {
      throw Error('Please set api-client and retry');
    }

    const r = new Promise((resolve, reject) => {
      const url = config.auth +
        '?response_type=token&client_id=' + prefs['api-client'] +
        '&scope=' + config.scopes +
        '&redirect_uri=' + chrome.identity.getRedirectURL('oauth2');

      const next = () => chrome.identity.launchWebAuthFlow({
        url,
        interactive
      }, redirectUrl => {
        const {lastError} = chrome.runtime;
        if (lastError) {
          return reject(Error(lastError.message));
        }
        core.log('engine.identity', redirectUrl);
        const args = new URLSearchParams(redirectUrl.split('#')[1]);
        core.storage.write({
          'type': args.get('token_type'),
          'token': args.get('access_token'),
          'expires': args.get('expires_in')
        }).then(resolve);
      });
      if (cache) {
        next();
      }
      else {
        chrome.identity.clearAllCachedAuthTokens(next);
      }
    });

    return r;
  }
  async fetch(path, options = {}, authorization = true) {
    options.headers = options.headers || {};
    if (authorization) {
      const {token, type} = await core.storage.read({
        token: '',
        type: 'Bearer'
      });
      options.headers['Authorization'] = type + ' ' + token;
    }
    return fetch(config.base + path, options);
  }
  async introduce(user) {
    const profile = await this.fetch(`users/${user.email}/profile`).then(r => r.json());
    if (profile.error) {
      throw Error(profile.error.message);
    }
    this.user.profile = profile;
    return profile.emailAddress;
  }
  async labels() {
    const r = await this.fetch(`users/${this.user.profile.emailAddress}/labels`).then(r => r.json());
    if (r.error) {
      throw Error(r.error.message);
    }
    this.user.labels = r.labels;
    return r.labels;
  }
  async threads(query) {
    const href = `users/${this.user.profile.emailAddress}/threads?q=` + encodeURIComponent(query);
    let r = await this.fetch(href).then(r => r.json());
    if (r.error) {
      core.log('renewing token / threads', r);
      this.authorize(true, true);
      r = await this.fetch(href).then(r => r.json());
    }
    if (r.error) {
      throw Error(r.error.message);
    }

    return r;
  }
  async messages(thread) {
    const href = `users/${this.user.profile.emailAddress}/messages/${thread.id}?` +
      'format=METADATA&metadataHeaders=Subject&metadataHeaders=From';
    let r = await this.fetch(href).then(r => r.json());
    if (r.error) {
      core.log('renewing token / messages', r);
      this.authorize(true, true);
      r = await this.fetch(href).then(r => r.json());
    }
    if (r.error) {
      throw Error(r.error.message);
    }

    return r;
  }
  async thread(thread) {
    const href = `users/${this.user.profile.emailAddress}/threads/${thread.id}`;
    let r = await this.fetch(href).then(r => r.json());
    if (r.error) {
      core.log('renewing token / thread', r);
      this.authorize(true, true);
      r = await this.fetch(href).then(r => r.json());
    }
    if (r.error) {
      throw Error(r.error.message);
    }

    return r;
  }
  // https://developers.google.com/gmail/api/guides/labels
  async action(threads, name) {
    const href = `users/${this.user.profile.emailAddress}/threads/`;
    if (name === 'delete') {
      return Promise.all(threads.map(thread => this.fetch(href + thread.id + '/trash', {
        method: 'POST'
      }).then(r => r.json())));
    }
    else {
      const addLabelIds = [];
      const removeLabelIds = [];
      if (name === 'mark-as-unread') {
        addLabelIds.push('UNREAD');
      }
      if (name === 'mark-as-read') {
        removeLabelIds.push('UNREAD');
      }
      if (name === 'archive') {
        removeLabelIds.push('INBOX');
      }
      if (name === 'move-to-inbox') {
        addLabelIds.push('INBOX');
      }
      if (name === 'report') {
        addLabelIds.push('SPAM');
      }
      if (name === 'add-star') {
        addLabelIds.push('STARRED');
      }
      if (name === 'remove-star') {
        removeLabelIds.push('STARRED');
      }

      const r = await Promise.all(threads.map(thread => this.fetch(href + thread.id + '/modify', {
        method: 'POST',
        body: JSON.stringify({
          addLabelIds,
          removeLabelIds
        })
      }).then(r => r.json())));

      await this.update();

      return r;
    }
  }
  async attachment(message, part) {
    const href = `users/${this.user.profile.emailAddress}/messages/${message.id}/attachments/${part.body.attachmentId}`;
    let r = await this.fetch(href).then(r => r.json());
    if (r.error) {
      core.log('renewing token / attachment', r);
      this.authorize(true, true);
      r = await this.fetch(href).then(r => r.json());
    }
    const url = 'data:' + part.mimeType + ';base64,' + r.data.replace(/-/g, '+').replace(/_/g, '/');

    return core.download({
      filename: part.filename || 'unknown',
      url
    });
  }
  async modify({message, addLabelIds = [], removeLabelIds = []}) {
    const href = `users/${this.user.profile.emailAddress}/messages/${message.id}/modify`;
    const r = await this.fetch(href, {
      method: 'POST',
      body: JSON.stringify({
        addLabelIds,
        removeLabelIds
      })
    }).then(r => r.json());
    return r;
  }
}

export default Engine;
