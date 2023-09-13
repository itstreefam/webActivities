# webActivities

A Google Chrome extension that aims to capture the information needed to generate usable code histories (capturing web search activity).

## Demo

https://user-images.githubusercontent.com/44308446/172900037-66332410-a1e5-4999-878f-48ab021aa4d4.mp4

## Requirements

* Node JS

## Extension Setup

1.  Clone this reprository. 

2.  Update the variable 'user_dir' in node/index.js with a folder path that you plan to perform your tasks/work on (i.e. the same workspace as the one in "[Extension Development Host]" VS Code window from codeHistories).

3.  From the main directory of webActivities in an external terminal, run ```npm run build``` to build the extension. Then run ```npm start``` to establish connection between the extension and the node server. Keep this node server (i.e. the terminal) running in the background.

4.  Open Google Chrome and go to ```chrome://extensions/```

5.  Turn on Developer mode (top right of the browser)

6.  Choose the option "Load unpacked" (under the big word Extension) and select the cloned "webActivities" directory as the folder.

## Important notes

<b>``` By default, all tabs recording is disabled, so make sure to turn them on for the tab/window you want to record. ```</b>

The user can start browsing Google Chrome as usual as the web urls are recorded and saved in a file named 'webData' in the 'user_dir.' 

The extension is set to finding a free port to run the node server, but user should check to make sure if the free port found matches the one from the extension popup page. This is because Node.js is not meant to be run on the browser or in a chrome extension, so there needs to be one additional level to confirming the port number on the extension's end. The popup page can be accessed by pinning the extension and then clicking on its "W" icon. Port number can be updated in here if not matched with node server's one. User can also turn recording on or off for certain tabs of their choice.

## Release Notes

### V1

Initial release of webActivities. Basic web activity capture in the background while the user is using Google Chrome. If the user chooses to pin the extension, there will be options that allow the user to choose which tab to be recorded or not. The data will be updated as the user unfocuses from any Chrome window.

### V1.x

Updated webActivites to be compatible with MacOS, Windows, and Linux by utilizing local node server instead of native messaging. Update speed may be slightly affected depending on the size of data and workload of local server. Added free port search, but user would still need to update on extension side via popup page if the two ports don't match.

### V2

Refactored background.js and updated webActivities to try and keep service worker active at all times (to avoid missing data). This approach made use of chrome offscreen API ```https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension```, so chrome version needs to be 109+.

### V2.x

Used webpack to bundle the extension. This allows the extension to be integrated with other javascript libraries. => Able to use websocket to send data to node server instead of using http request. Checking app switch is also done to automatically reload localhost if user switches from VS Code to Chrome (This addresses capturing live reloading events).

## Contact

Feel free to let me know if there is any suggestions, comments, feedbacks, etc. at p.tri@wustl.edu

**Thanks and enjoy!**
