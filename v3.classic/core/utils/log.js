const log = (origin, ...args) => {
  let color = 33;
  switch (origin) {
  case '[offscreen]':
    color = 31;
    break;
  case '[repeater]':
    color = 32;
    break;
  case '[feed]':
    color = 35;
    break;
  case '[menu]':
    color = 36;
    break;
  }
  console.info('\x1b[' + color + 'm%s\x1b[0m', origin, ...args);
};
