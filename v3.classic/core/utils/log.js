const log = (origin, ...args) => {
  const cc = [
    '#ff0099',
    '#ff9900',
    '#c46dff',
    '#0099ff',
    '#66cc00',
    '#00cc66'
  ];

  let n = 0;
  switch (origin) {
  case '[offscreen]':
    n = 1;
    break;
  case '[menu]':
    n = 2;
    break;
  case '[feed]':
    n = 3;
    break;
  case '[repeater]':
    n = 4;
    break;
  case '[play]':
    n = 5;
    break;
  }
  console.info('%c' + origin, 'color:' + cc[n], ...args);
};
