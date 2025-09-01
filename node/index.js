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

let serverSettings = {
    projectPath: String.raw``, // Default fallback
    enableCapture: true
};

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

                if (parsedMessage.action === 'updateSettings') {
                    const settings = parsedMessage.settings;
                    
                    if (settings.projectPath) {
                        serverSettings.projectPath = settings.projectPath;
                        console.log('Project path updated to:', settings.projectPath);
                    }
                    
                    if (typeof settings.enableCapture !== 'undefined') {
                        serverSettings.enableCapture = settings.enableCapture;
                        console.log('Screenshot capture', settings.enableCapture ? 'enabled' : 'disabled');
                    }
                    
                    chromeExtensionSocket.send(JSON.stringify({ 
                        status: 'settings_updated',
                        settings: serverSettings 
                    }));
                    return;
                }

                if (parsedMessage.action === 'captureScreen') {
                    // Check if capture is enabled
                    if (!serverSettings.enableCapture) {
                        console.log('Screenshot capture is disabled');
                        chromeExtensionSocket.send(JSON.stringify({
                            status: 'disabled',
                            message: 'Screenshot capture is disabled'
                        }));
                        return;
                    }

                    try {
                        // Use the dynamic project path instead of hardcoded user_dir
                        const user_dir = serverSettings.projectPath;
                        
                        if (!user_dir) {
                            throw new Error('No project path configured');
                        }

                        // Make screenshots directory
                        const screencaptures_dir = path.join(user_dir, 'screencaptures');
                        if (!fs.existsSync(screencaptures_dir)) {
                            fs.mkdirSync(screencaptures_dir, { recursive: true });
                        }

                        const filepath = path.join(screencaptures_dir, parsedMessage.filename);
                        await functionCaptureScreenshot(filepath);

                        chromeExtensionSocket.send(JSON.stringify({
                            status: 'success'
                        }));
                        
                    } catch (error) {
                        console.error('Screenshot capture failed:', error);
                        chromeExtensionSocket.send(JSON.stringify({
                            status: 'error',
                            message: error.message
                        }));
                    }
                    return;
                }

                // Handle web data logging
                let urlResult = parsedMessage;
                
                // Use the dynamic project path
                const user_dir = serverSettings.projectPath;
                
                if (!user_dir) {
                    console.error('No project path configured for web data');
                    return;
                }
                
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