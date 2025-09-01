const path = require('path');
const fs = require('fs');
const portfinder = require('portfinder');
const activeWin = require('active-win');
const WebSocket = require('ws');
const screencapture = require('screenshot-desktop');
const { Window } = require('node-screenshots');
var intervalId;
var previousAppName = '';
let chromeExtensionSocket = null;

portfinder.setBasePort(4000);    // default: 8000
portfinder.setHighestPort(65535); // default: 65535

// const functionCaptureScreenshot = async (filepath) => {
//     try {
//         await screencapture({ filename: filepath });
//         console.log('Screenshot saved to:', filepath);

//     } catch (error) {
//         console.error('Screenshot error:', error);
//         throw error;
//     }
// };

const functionCaptureScreenshot = async (filepath) => {
    try {
        let windows = Window.all();
        
        if (windows.length === 0) {
            throw new Error('No displays found');
        }
        
        console.log(`Found ${windows.length} displays`);
        let targetWindow = null;
        
        // find primary display with reasonable dimensions
        targetWindow = windows.find(window => 
            window.isPrimary && 
            window.width > 100 && 
            window.height > 100
        );
        
        // find largest display if no good primary
        if (!targetWindow) {
            targetWindow = windows
                .filter(window => window.width > 100 && window.height > 100)
                .reduce((largest, current) => {
                    const currentArea = current.width * current.height;
                    const largestArea = largest ? (largest.width * largest.height) : 0;
                    return currentArea > largestArea ? current : largest;
                }, null);
        }
        
        // just use first available if all else fails
        if (!targetWindow) {
            targetWindow = windows[0];
        }
        
        // console.log('Using display:', {
        //     id: targetWindow.id,
        //     dimensions: `${targetWindow.width}x${targetWindow.height}`,
        //     position: `(${targetWindow.x}, ${targetWindow.y})`,
        //     isPrimary: targetWindow.isPrimary,
        //     scaleFactor: targetWindow.scaleFactor
        // });
        
        // try synchronous capture first (often more reliable)
        const image = targetWindow.captureImageSync();
        const pngBuffer = image.toPngSync();
        
        console.log(`Screenshot buffer size: ${pngBuffer.length} bytes`);
        
        fs.writeFileSync(filepath, pngBuffer);
        console.log(`Screenshot saved: ${filepath}`);
        
        return pngBuffer;
        
    } catch (error) {
        console.error('Screenshot error:', error);
        throw error;
    }
};

portfinder.getPortPromise()
    .then((port) => {
		const user_dir = String.raw`C:\Users\Tin Pham\Desktop\pathfinding-algo`;

        // Start the first interval
	    intervalId = setTimeout(checkAppSwitch, 500);

        const wss = new WebSocket.Server({ port });
        wss.on('connection', (ws) => {
            console.log('Server is running on found free port: ' + port);
            console.log('Make sure to also update base port in extension popup page to ' + port + ' if they are not matched.');
            
            chromeExtensionSocket = ws;
            chromeExtensionSocket.on('message', async (message) => {
                if (typeof message !== 'string') {
                    message = message.toString('utf8');
                }
                const parsedMessage = JSON.parse(message);

                if (parsedMessage.action === 'Capture screen') {
                    // make a new directory for screenshots if not exist
                    const screencaptures_dir = path.join(user_dir, 'screencaptures');
                    if (!fs.existsSync(screencaptures_dir)) {
                        fs.mkdirSync(screencaptures_dir);
                    }

                    const filepath = path.join(screencaptures_dir, parsedMessage.filename);
                    await functionCaptureScreenshot(filepath);

                    chromeExtensionSocket.send(JSON.stringify({
                        status: 'success'
                    }));
                    return;  // to ensure the following logic doesn't run in this case
                }

                let urlResult = parsedMessage;
                let file = path.join(user_dir, 'webData');
                let data = JSON.stringify(urlResult, undefined, 4);

                if (fs.existsSync(file)) {
                    let oldData = JSON.parse(fs.readFileSync(file, 'utf-8'));
                    let newData = oldData.concat(urlResult);
                    newData = Array.from(new Set(newData.map(JSON.stringify))).map(JSON.parse);
                    fs.writeFileSync(file, JSON.stringify(newData, undefined, 4));
                } else {
                    fs.writeFileSync(file, data, (err) => {
                        if (err) throw err;
                    });
                }
            });
        
            chromeExtensionSocket.send('Hello from Node folder/server!');
        });
    })
    .catch((err) => {
        console.log(err);
    });

const checkAppSwitch = async () => {
    try {
    const activeApp = await activeWin({accessibilityPermission: true, screenRecordingPermission: true});
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