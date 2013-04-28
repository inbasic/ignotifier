var fs      = require('fs'), 
    path    = require('path'),
    program = require('commander'),
    clc     = require('cli-color'),
    spawn   = require('child_process').spawn,
    exec    = require('child_process').exec;

/** Command Line setup **/
program
  .version('0.0.1')
  .option('-r, --run', 
    'Run extension in a clean profile ' +
    '(equivalent to cfx run). No xpi file will be generated in this mode!'
  )
  .option('-w, --wget', 
    'Run extension in current profile ' +
    'Wget and Extension auto installer are required.'
  )
  .option('-e, --xpi', 
    'Create XPI file in cLinux dir'
  )
  .option('-j, --jsconsole', 
    'Show jsConsole in run mode'
  )
  .option('-i, --ip <ip>', 
    'Send XPI to this host [localhost]',
    'localhost'
  )
  .option('--sdk <sdk path>', 
    'Path to the Mozilla Add-On SDK library [..]',
    '..'
  )
  .parse(process.argv);
  
/** Wget **/
var installer = function (callback) {
  var child;

  var cmd = "ls src/*.xpi"
  child = exec(cmd, {}, function (error, stdout, stderr) {
      if (stdout) {
        cmd = (isWindows ? 'compile\\wget' : 'wget') + 
              ' --post-file=' + /.*/.exec(stdout) + 
              ' http://' + program.ip + ':8888/';
        console.log(cmd);
        child = exec(cmd, {}, function (error, stdout, stderr) {
          if (stdout)
            console.log(stdout);
          if (stderr)
            console.log(clc.red(stderr));
        });
      }
      if (stderr)
        console.log(clc.red(stderr));
  });
}
  
/** Find SDK **/
var isWindows = !!process.platform.match(/^win/);

fs.readdir(program.sdk, function (err, files) {
  if (err) throw new Error(err);

  var actualAddonPath, sdkVersion;
  /** In case user supplied path pointing to actual SDK directory **/
  if (/addon-sdk/.test(program.sdk) !== false) {
    actualAddonPath = program.sdk;
    sdkVersion = actualAddonPath
  } else {
    files = files.filter(function (file) {
      return /^addon-sdk-/.test(file);
    }).sort(function (a, b){
      /** If the directory used has multiple addon-sdk folders, make sure we use the most recent **/
      var _patern = /(\d+)/g;
      var temp1 = a.match(_patern), temp2 = b.match(_patern);
      for (var i = 0; i < 10; i++) {
        if (temp1[i] != temp2[i]) {
          return parseInt(temp1[i])<parseInt(temp2[i]);
        }
      }
    });
    if (!files.length) throw new Error("Addon-sdk not found");
    actualAddonPath = program.sdk + path.sep + files[0];
    sdkVersion = files[0];
  }

  var bootstrap = actualAddonPath + "/app-extension/bootstrap.js";
  var sdk = actualAddonPath + (isWindows ? "/bin" : "");
  console.log(clc.green(
    "SDK version: " + sdkVersion + "\n" + 
    "bootstrap found at: " + bootstrap
  ));

  /** Replace bootstrap.js **/
  stats = fs.lstatSync('template/');
  if (stats.isDirectory()) {
    fs.createReadStream(bootstrap).pipe(fs.createWriteStream('template/bootstrap.js'));
  }

  /** Execute cfx **/
  var cfx = spawn(isWindows ? 'cmd' : 'bash', [], { cwd: sdk });
  if (!isWindows) cfx.stdin.write("echo Bash\n");

  var stage = 0;
  cfx.stdout.on('data', function (data) {
    console.log(clc.xterm(250)(data));
    switch (stage) {
      case 0:
        cfx.stdin.write(isWindows ? "activate\n" : "echo step 1&&source bin/activate\n");
        stage += 1;
        break;
      case 1:
        stage += 1;
        break;
      case 2:
        cfx.stdin.write("echo step 2&&cd " + __dirname + "/..\n");
        stage += 1;
        break;
      case 3:
        cfx.stdin.write("echo step 3&&cd src\n");
        stage += 1;
        break;
      case 4:
        cfx.stdin.write(
          "cfx --templatedir=../template " + 
          ((program.xpi || program.wget) ? "xpi&&echo step 4" : (
            "run" + (program.jsconsole ? " --binary-args -jsconsole" : "") + "&&echo step 4"
          )) + "\n"
        );
        stage += 1;
        break;
      case 5:
        cfx.stdin.write("echo step 5&&exit\n");
        stage += 1;
        break;
      case 6:
        stage += 1;
        if (isWindows) break;
      case 7:
        if (program.wget) {
          setTimeout(function(){installer()}, 1000);
        }
        stage += 1;
        break;
    }
  });
  cfx.stderr.on('data', function (data) {
    console.log(clc.red('stderr: ' + data));
  });
  cfx.on('exit', function (code) {
    console.log(clc.green('Exited code: ' + code));
  });
});
