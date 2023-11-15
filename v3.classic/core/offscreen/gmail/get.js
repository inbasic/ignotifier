const get = {
  base: url => /[^?]*/.exec(url)[0].split('/h')[0].replace(/\/$/, ''),
  id: url => {
    const tmp = /message_id=([^&]*)/.exec(url);
    if (tmp && tmp.length) {
      return tmp[1];
    }
    return null;
  }
};
