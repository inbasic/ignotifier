'use strict';

/* References
 * https://github.com/foudfou/FireTray/tree/winnt/src/modules/winnt
 * http://www.codeproject.com/Articles/4768/Basic-use-of-Shell_NotifyIcon-in-Win32
 */

var {Cc, Ci, Cu}  = require('chrome'),
    pageWorker    = require('sdk/page-worker'),
    self          = require('sdk/self'),
    data          = self.data,
    unload        = require('sdk/system/unload'),
    oscpu         = Cc['@mozilla.org/network/protocol;1?name=http']
      .getService(Ci.nsIHttpProtocolHandler).oscpu,
    version       = parseInt((/\d\.\d/.exec(oscpu) || ['0'])[0].replace('.', '')), // Windows Version
    config        = require('../../../../config');

var {XPCOMUtils} = Cu.import('resource://gre/modules/XPCOMUtils.jsm');
var {ctypes} = Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import('resource://gre/modules/Promise.jsm');

if (self.loadReason === 'install') {
  if (version >= 60) { //Vista
    config.tray.doTrayCallback = true;
  }
}

// private variables
var BOOL      = ctypes.bool,
    BYTE      = ctypes.unsigned_char,
    WORD      = ctypes.unsigned_short,
    DWORD     = ctypes.unsigned_long,
    UINT      = ctypes.unsigned_int,
    HANDLE    = ctypes.voidptr_t,
    HWND      = HANDLE,
    HICON     = HANDLE,
    HINSTANCE = HANDLE,
    TCHAR     = ctypes.jschar,
    LPVOID    = ctypes.voidptr_t,
    INT       = ctypes.int,
    is64bit   = ctypes.size_t.size === 8,
    LONG_PTR  = is64bit ? ctypes.int64_t : ctypes.long,
    LRESULT   = LONG_PTR,
    UINT_PTR  = is64bit ? ctypes.uint64_t : ctypes.unsigned_int,
    WPARAM    = UINT_PTR,
    LPARAM    = LONG_PTR;
// private StructTypes
var GUID = ctypes.StructType('GUID', [
  {'Data1': ctypes.unsigned_long},
  {'Data2': ctypes.unsigned_short},
  {'Data3': ctypes.unsigned_short},
  {'Data4': ctypes.char.array(8)}
]),
NOTIFYICONDATAW = ctypes.StructType('NOTIFYICONDATAW', [
  {'cbSize': DWORD},
  {'hWnd': HWND},
  {'uID': UINT},
  {'uFlags': UINT},
  {'uCallbackMessage': UINT},
  {'hIcon': HICON},
  {'szTip': ctypes.ArrayType(TCHAR, 128)},
  {'dwState': DWORD},
  {'dwStateMask': DWORD},
  {'szInfo': ctypes.ArrayType(TCHAR, 256)},
  {'uTimeoutOrVersion': UINT}, // union
  {'szInfoTitle': ctypes.ArrayType(TCHAR, 64)},
  {'dwInfoFlags': DWORD},
  {'guidItem': GUID},
  {'hBalloonIcon': HICON}
]);
// private FunctionTypes
var WNDPROC = ctypes.FunctionType(ctypes.stdcall_abi, LRESULT, [HWND, UINT, WPARAM, LPARAM]).ptr;
// libraries
var user32 = ctypes.open('user32.dll'),
    shell32 = ctypes.open('shell32.dll');
XPCOMUtils.defineLazyGetter(user32, 'DefWindowProcW', function() {
  return user32.declare('DefWindowProcW', ctypes.winapi_abi, LRESULT, HWND, UINT, WPARAM, LPARAM);
});
XPCOMUtils.defineLazyGetter(user32, 'SetWindowLongPtrW', function() {
  return user32.declare(is64bit ? 'SetWindowLongPtrW' : 'SetWindowLongW', ctypes.winapi_abi, LONG_PTR , HWND, INT, LONG_PTR);
});
XPCOMUtils.defineLazyGetter(user32, 'CreateIcon', function() {
  return user32.declare('CreateIcon', ctypes.winapi_abi, HICON, HINSTANCE, INT , INT, BYTE, BYTE, LPVOID, LPVOID);
});
XPCOMUtils.defineLazyGetter(shell32, 'Shell_NotifyIconW', function() {
  return shell32.declare('Shell_NotifyIconW', ctypes.winapi_abi, BOOL, DWORD, NOTIFYICONDATAW.ptr);
});

// notification icon
function icon (badge) {
  var d = new Promise.defer();
  function getIcon () {
    var canvas = document.getElementById('canvas');
    var context = canvas.getContext('2d');
    var img = new Image();
    img.onload = function () {
      var xText, xRect;
      switch ('badge'.length) {
      case 1:
        [xText, xRect] = [10, 8];
        break;
      case 2:
        [xText, xRect] = [5, 3];
        break;
      default:
        [xText, xRect] = [1, 0];
        break;
      }
      context.drawImage(img, 0, badge > 0 ? 1 : 3);
      if (badge > 0) {
        context.fillStyle = '#3366CC';
        context.fillRect (xRect, 6, 16, 16);
        context.fillStyle = '#fff';
        context.font = '9px Arial';
        context.fillText('badge'.length <= 3 ? 'badge' : '999', xText, 14);
      }
      var arr = context.getImageData(0, 0, 16, 16).data, tmp = [];
      for (var i = 0, n = arr.length; i < n; i += 4) {   //r,g,b,alpha
        [tmp[i + 1], tmp[i + 3]] = [arr[i + 1], arr[i + 3]];
        [tmp[i + 2], tmp[i]]  = [arr[i], arr[i + 2]];
      }
      self.postMessage(tmp);
    };
    img.src = 'source';
  }
  var color = badge > 0 ? 'red' : badge === -1 ? 'blue' : 'gray';
  if (config.ui && config.ui.pattern === 1) {
    switch (color) {
    case 'blue':
      color = 'gray';
      break;
    case 'gray':
      color = 'blue';
      break;
    }
  }
  var worker = pageWorker.Page({
    contentURL: data.url('firefox/notification.html'),
    contentScript: ('(' + getIcon)
      .replace(/source/g, data.url('icons/tray/' + color + '.png'))
      .replace(/badge/g, badge) +
      ')();',
    onMessage: function (arr) {
      d.resolve(arr);
      worker.destroy();
    }
  });
  return d.promise;
}

// hWnd
function getHWND () {
  // Hidden Window
  var hiddenWindow = Cc['@mozilla.org/appshell/appShellService;1']
    .getService(Ci.nsIAppShellService).hiddenDOMWindow;
  // Getting base Window
  var baseWindow = hiddenWindow.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIWebNavigation)
    .QueryInterface(Ci.nsIDocShellTreeItem)
    .treeOwner
    .QueryInterface(Ci.nsIInterfaceRequestor)
    .nsIBaseWindow;
  return ctypes.cast(ctypes.uintptr_t(baseWindow.nativeHandle), ctypes.voidptr_t);
}
var hWnd = getHWND();

// preparing notification
var nid = new NOTIFYICONDATAW;
nid.hWnd = hWnd;
nid.uID = config.tray ? config.tray.id.unique : 24342;
nid.uCallbackMessage = config.tray ? config.tray.id.msg : 665;
nid.uTimeoutAndVersion = (config.tray ? config.tray.time.notification : 3) * 1000;
nid.uFlags = 0x00000001 /* NIF_MESSAGE */ | 0x00000002 /* NIF_ICON */ | 0x00000004 /* NIF_TIP */ /* | 0x000000010  NIF_INFO */;
nid.dwInfoFlags = 0x00000001 /* NIIF_INFO */;
//nid.szInfoTitle = _('gmail'); // 'Balloon Tooltip' title
nid.cbSize = (function () {
  function FIELD_OFFSET(aType, aField, aPos) {
    var addr2nb = (a) => ctypes.cast(a, ctypes.unsigned_long).value,
        s = new aType(),
        addr_field = typeof(aPos) === 'undefined' ? addr2nb(s.addressOfField(aField)) : addr2nb(s[aField].addressOfElement(aPos));
    return addr_field - addr2nb(s.address());
  }
  if (version >= 60) { //Vista
    return NOTIFYICONDATAW.size;
  }
  if (version >= 51) { //XP
    return FIELD_OFFSET(NOTIFYICONDATAW, 'hBalloonIcon');
  }
  if (version >= 50) { //2K
    return FIELD_OFFSET(NOTIFYICONDATAW, 'guidItem');
  }
  return FIELD_OFFSET(NOTIFYICONDATAW, 'szTip', 64);
})();
// callback listener
var callback;
var proxyWndProc = WNDPROC (function (hWnd, uMsg, wParam, lParam) {
  if (config.tray && uMsg === config.tray.id.msg && (+lParam === 513 || +lParam === 517)) {
    if (callback) {
      callback();
    }
  }
  return user32.DefWindowProcW(hWnd, uMsg, wParam, lParam);
});

var oldOffset;
if (config.tray && config.tray.doTrayCallback) {
  oldOffset = user32.SetWindowLongPtrW(hWnd, -4 /* GWLP_WNDPROC */, ctypes.cast(proxyWndProc, LONG_PTR));
}

var isInstalled = false;
exports.set = function (badge, msg) {
  if (!config.tray.show) {
    return;
  }
  //nid.szInfo = msg;
  nid.szTip = msg.substring(0, 63); // maximum of 64 characters
  icon(badge).then(function (arr) {
    var  uint8Array = new  Uint8Array(arr);
    nid.hIcon = user32.CreateIcon(hWnd, 16, 16, 1, 32, uint8Array, uint8Array);
    shell32.Shell_NotifyIconW(
      isInstalled ? 0x00000001 /* NIM_MODIFY */ : 0x00000000 /* NIM_ADD */,
      nid.address()
    );
    isInstalled = true;
  });
};
exports.remove = function () {
  if (!isInstalled) {
    return;
  }
  shell32.Shell_NotifyIconW(0x00000002 /* NIM_DELETE */, nid.address());
  isInstalled = false;
};
exports.callback = function (c) {
  callback = c;
};

unload.when(function () {
  exports.remove();
  if (oldOffset) {
    user32.SetWindowLongPtrW(hWnd, -4, oldOffset);
  }
});
