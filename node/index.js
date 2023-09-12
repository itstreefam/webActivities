const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { performance } = require('perf_hooks');
const portfinder = require('portfinder');
const activeWin = require('active-win');
const http = require('http');
const WebSocket = require('ws');
var intervalId;
var previousAppName = '';
let chromeExtensionSocket = null;

portfinder.setBasePort(4000);    // default: 8000
portfinder.setHighestPort(65535); // default: 65535

portfinder.getPortPromise()
    .then((port) => {
        //
        // `port` is guaranteed to be a free port in this scope.
        //
        let time = performance.now();

        const user_dir = String.raw`C:\Users\thien\Desktop\test-react\steam-clone`;

        const app = express();

        app.use(cors());
        app.use(express.json({limit: '50mb'}));
        app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 100000}));

        app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header('Access-Control-Allow-Methods', 'DELETE, PUT, GET, POST');
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });

        app.post('/logWebData', (req, res) => {
            let urlResult = req.body;
            
            // save urlResult to data in user_dir
            let file = path.join(user_dir, 'webData');
            let data = JSON.stringify(urlResult, undefined, 4);
            
            // if user_dir already has data
            if (fs.existsSync(file)) {
                // if file is empty
                if (fs.readFileSync(file).length === 0) {
                    fs.writeFileSync(file, data);
                } else {
                    let oldData = JSON.parse(fs.readFileSync(file, 'utf-8'));
                    
                    // merge oldData and urlResult
                    let newData = oldData.concat(urlResult);

                    // remove duplicate objects in newData
                    newData = Array.from(new Set(newData.map(JSON.stringify))).map(JSON.parse);

                    // write newData to file
                    fs.writeFileSync(file, JSON.stringify(newData, undefined, 4));
                }
            } else {
                fs.writeFileSync(file, data, (err) => {
                    if (err) throw err;
                });
            }
            // console.log(`${(performance.now() - time) / 1000} seconds`);
            res.send('ok');
        });

        // Start the first interval
	    intervalId = setTimeout(checkAppSwitch, 500);

        // app.listen(port, () => {
        //     console.log('Server is running on found free port: ' + port);
        //     console.log('Make sure to also update base port in extension popup page to ' + port + ' if they are not matched.');
        // });

        // Create an HTTP server
        const server = http.createServer(app);

        // Create WebSocket server by passing the HTTP server instance
        const wss = new WebSocket.Server({ server });

        wss.on('connection', (ws) => {
            console.log('WebSocket Client Connected');
            chromeExtensionSocket = ws;

            ws.on('message', (message) => {
                // if message is not a string, convert it to string
                if (typeof message !== 'string') {
                    message = message.toString('utf8');
                    console.log('Received:', message);
                }
            });

            ws.send('Hello from Node.js!');
        });

        server.listen(port, () => {
            console.log('Server is running on found free port: ' + port);
            console.log('Make sure to also update base port in extension popup page to ' + port + ' if they are not matched.');
        });

    })
    .catch((err) => {
        console.log(err);
    });

const checkAppSwitch = async () => {
    try {
    const activeApp = await activeWin();
    // console.log(activeApp);

    if (activeApp && activeApp.owner && activeApp.owner.name) {
        const currentAppName = activeApp.owner.name.toLowerCase();
        // console.log(currentAppName);

        if(currentAppName !== "windows explorer"){ // special case for windows
            if (previousAppName.includes('code') && currentAppName.includes('chrome')) {
                // Send message to client
                if(chromeExtensionSocket) {
                    chromeExtensionSocket.send('Switched from VS Code to Chrome');
                }
            }
            previousAppName = currentAppName;
        }
    }

    // Set the next interval after processing the current one
    intervalId = setTimeout(checkAppSwitch, 500);
    } catch (error) {
        console.error('Error occurred while checking for app switch:', error);
        intervalId = setTimeout(checkAppSwitch, 500);
    }
};