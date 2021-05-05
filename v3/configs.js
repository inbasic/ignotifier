window.CONFIGS = {
  'opening-mode': 'popup', // tab, popup
  'default-page': 'https://mail.google.com/mail/u/0/#inbox',
  /* engine */
  'default-engine': 'rss', // 'rss' or 'api',
  'default-engine-mapping': {}, // {'me@gmail.com': 'api', 'you@gmail.com': 'rss'}
  /* badge */
  'badge-text-format': `{EMAIL}:
   @@{QUERY} ({COUNT})

Last checked: {DATE}`, // valid keywords: "{EMAIL}", "{QUERY}", "{COUNT}", "{SNIPPET}", "{DATE}"
  'badge-delay': 10, // minutes
  'badge-period': 10, // minutes
  'idle-detection': 5, // minutes
  /* popup */
  'popup-csp': `default-src 'none'; style-src 'unsafe-inline';`,
  'popup-switch-to-unread-user': true, // try to find a logged-in user with unread emails
  'popup-switch-to-unread-query': true, // try to find a query for the current user with unread emails
  'popup-mark-read-on-view': false,
  /* notification */
  'queries': {}, // {me@gmail.com: ['label:inbox is:unread', ...]}
  'default-queries': ['label:INBOX is:unread'], // if an email does not have a query, use this. use "IGNORE" to bypass
  'notification': {}, // {me@gmail.com: {'query': {sound: true, desktop: true, source: 0}}}
  'ignored-users': [],
  'notification-text-format': `{USER} {QUERY} ({COUNT})`,
  'sound-volume': 0.8,
  'api-client-id': '' // [user-client-id].apps.googleusercontent.com
};

// preferences with no direct interaction
Object.assign(window.CONFIGS, {
  'popup-collapsed-message': 'snippet', // snippet or complete
  'popup-view': 'grid', // single, grid
  'grid-view': '12', // 11, 12, 1_1, 1_2
  'popup-account': {}, // {email, query}
  'popup-mode': 'expanded', // collapsed or expanded
  'notification-counts': {}, // {email: {query: count}}
  'custom-sounds': {} // {'hash': {binary: '', id}}
});
