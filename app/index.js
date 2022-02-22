const electron = require("electron"); 

var ape = electron.app;
var BrowserWindow = electron.BrowserWindow;
var Menu = electron.Menu;

Menu.setApplicationMenu(null);

const path = require("path");

const fs = require("fs");


global.processes = [];
var existing_ports = [];
function portgen(){
var rnlength = Math.random().toString().split('.').pop().split('').length;
var rnum = Math.random().toString().split('.').pop().split('').slice(0, 2);
global.new_rnum="";
if (rnum[0] == '0') {
new_rnum = '1' +  rnum[1]
}
else {
new_rnum = rnum.join('');
}
if (existing_ports.indexOf(new_rnum) !== -1) {
existing_ports.push(new_rnum);
} 
return new_rnum;
}

var settings = JSON.parse(fs.readFileSync("settings.json").toString());

function json_to_args(e) {
  var n = [];
  for (var t in e) {
    n.push("-" + t + " " + e[t]);
  }
  return n.join(" ")
}

settings = json_to_args(settings);

function portrm(port){
       existing_ports = existing_ports.filter(function(ele){ 
            return ele != port; 
        });
		global.processes[port].kill();
		
}

var { spawn } = require('child_process');
var http = require('http');
var express = require('express');
var svnc = require('../index.js');

/* serve your app */
var app = express();
app.use(require('express-all-allow')())
app.use(express.json())
var httpServer = http.createServer(app);
app.get('/vnc.js', function(req, res){
  res.sendFile(__dirname + '/vnc.js');
})

app.post('/api/init', function(req, res){
	var port = portgen();
	var e = settings.split(" ");
	e.push("-vnc");
	e.push("127.0.0.1:" + port);
	e = e.join(" ")
    var http_default = "59" + port;
	res.send({success: true, port: "59" + port});
	global.processes[http_default] = spawn("\"app/qemu-system-x86_64.exe\" " + e, {shell: true, stdio: "inherit"});
		console.log("\"app/qemu-system-x86_64.exe\" " + e);
});
app.post('/api/reboot', function(req, res){
	var port = portgen();
	var port_to_kill = req.body.port;
	console.log(req.body, req.body.port);
	var http_default = "59" + port;
	var e = settings.split(" ");
	e.push("-vnc");
	e.push("127.0.0.1:" + port);
portrm(port_to_kill)
setTimeout(function(){
	global.processes[http_default] = spawn("\"app/qemu-system-x86_64.exe\" " + e, {shell: true, stdio: "inherit"});
	console.log("\"app/qemu-system-x86_64.exe\" " + e);
}, 5000);
	res.send({success: true, port: "59" + port});
	});
app.post('/api/off', function(req, res){
		var port_to_kill = req.body.port;
portrm(port_to_kill);
	res.send({success: true});
});

app.get('/', function(req, res){
	res.send(`
	<style>
.display {
	position: fixed;
	transform: translate(-50%, -50%);
	left: 50%;
	top: 50%;
}
</style>
<body>
  <script src="vnc.js"></script>
      <div id="screen-wrapper" class="display" style="display: none;  box-shadow: 0 4px 8px 0 rgb(138,43,226), 0 6px 20px 0 rgb(138,43,226);">
          <canvas id="screen" style="background: black;">
          </canvas>
        </div>
		<button id="connect" style="position: absolute; transform: translate(-50%, -50%); left: 50%; top: 50%;" onclick="init()">Connect</button>
		<small style="position: absolute; transform: translate(-50%, -50%); left: 50%; top: 60%; display: none;"> Initializing virtual machine... </small>
		<progress max="126" value="0" style="position: absolute; transform: translate(-50%, -50%); left: 50%; top: 70%; display: none;"></progress>
<script>
var timeout = 126000;
function init(){
document.querySelector('#connect').disabled = true;
document.querySelector('small').style.display = "block";
document.querySelector('progress').style.display = "block";
bootUp();
var i = setInterval(function(){
	document.querySelector('progress').value = document.querySelector('progress').value + 0.1;
}, 100)
setTimeout(function(){
	clearInterval(i);
	document.querySelector('progress').style.display = "none";
	document.querySelector('small').style.display = "none";
}, timeout);
};

function bootUp(){
fetch('http://localhost:8080/api/init', {
    method: 'POST'
})
.then(res => res.json())
.then(function(res){
window.vnc_port = res.port;
setTimeout(function(){
 vnc(svnc => {
	     document.body.style.background = "black";
    /* attach screen to canvas, create client */
var canvas = document.getElementById('screen'),
  screen = new svnc.Screen(canvas),
  client = new svnc.Client(screen);

var screenWrapper = document.getElementById('screen-wrapper');

  var config = {
    host: "127.0.0.1",
    port: res.port
  };

  /* connect to a vnc server */
  client.connect(config).then(function() {
    screenWrapper.style.display = 'block';
document.querySelector('#connect').style.display = "none";
document.querySelector('#control').style.display = "block";
document.querySelector('small').style.display = "none";
document.body.onbeforeunload = function(){
fetch('http://localhost:8080/api/off', {
    method: 'POST',
	  headers: {
        'Content-Type': 'application/json'
    },
	body: JSON.stringify({port: window.vnc_port})
})
}
  }).catch(function(error) {
    console.error('Connect failed:', error);
  })
}, false);
}, timeout);
})
;
}
</script>
</body>`);
})
httpServer.listen(8080);
console.log('Listening on port', 8080);

/* fire up simplevnc server */
var server = new svnc.Server(httpServer);
server.on('connect', function(client){
  console.log('svnc client connected');
})
server.on('disconnect', function(client){
  console.log('svnc client disconnected');
})
server.on('error', function(err){
  console.error('svnc error', err)
})

const loadMainWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 850,
        height: 700,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.loadURL("http://localhost:8080");
}

ape.on("ready", loadMainWindow);

ape.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    ape.quit();
  }
});

ape.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        loadMainWindow();
    }
});
