var fs      = require('fs'), 
    program = require('commander'),
    clc     = require('cli-color'),
    spawn   = require('child_process').spawn;
/** Command Line setup **/
program
  .version('0.0.1')
  .option('-r, --run', 
    'Run extension in a clean profile ' +
    '(equivalent to cfx run). No xpi file will be generated in this mode!'
  )
  .option('-e, --xpi', 
    'Create XPI file in cLinux dir'
  )
  .option('-j, --jsconsole', 
    'Show jsConsole in run mode'
  )
  .parse(process.argv);
/** Find SDK **/
fs.readdir(".", function (err, files) {
  if (err) throw new Error(err);

  files = files.filter(function (file) {
    return /^addon-sdk-/.test(file);
  }).sort(function (a, b){
    var _patern = /(\d+)/g;
    var temp1 = a.match(_patern), temp2 = b.match(_patern);
    for (var i = 0; i < 10; i++) {
      if (temp1[i] != temp2[i]) 
        return parseInt(temp1[i])<parseInt(temp2[i]);
    }
  });
  if (!files.length) throw new Error("Addon-sdk not found");
  var sdk = "./" + files[0] + "/bin";
  console.log(clc.green("SDK found: " + files[0]));
  /** Execute cfx **/
  var cfx = spawn('cmd', [], { cwd: sdk });
  var stage = 0;
  cfx.stdout.on('data', function (data) {
    console.log(clc.gray(data));
    switch (stage) {
      case 0:
        cfx.stdin.write("activate\n");
        stage += 1;
        break;
      case 1:
      case 2:
        cfx.stdin.write("cd ..\n");
        stage += 1;
      case 3:
        cfx.stdin.write("cd src\n");
        stage += 1;
      case 4:
        cfx.stdin.write(
          "cfx --templatedir=../template " + 
          (program.xpi ? "xpi" : (
            "run" + (program.jsconsole ? " --binary-args -jsconsole" : "")
          )) + "\n"
        );
        stage += 1;
      case 5:
        cfx.stdin.write("exit\n");
        stage += 1;
    }
  });
  cfx.stderr.on('data', function (data) {
    console.log(clc.red('stderr: ' + data));
  });
  cfx.on('exit', function (code) {
    console.log(clc.green('Exited code: ' + code));
  });
});