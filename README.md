# webActivities

A Google Chrome extension that aims to capture the information needed to generate usable code histories (capturing web search activity).

## Demo

https://user-images.githubusercontent.com/44308446/172900037-66332410-a1e5-4999-878f-48ab021aa4d4.mp4

## Requirements

* Node JS

## Extension Settings

Clone this reprository. Then go into the node folder and run "npm i" to install all dependencies. After that, update the variable 'user_dir' in node/index.js with a folder path that the user plans to perform their tasks/work on. 

Run "node index.js" inside the node folder to start up the localhost node server that can capture the web data information and communicate them to a user's working folder. Finally, load the extension on Google Chrome by visiting chrome://extensions/, turning on Developer mode, and choosing the option Load unpacked.

The user can start browsing Google Chrome as usual as the web urls are recorded and saved in a file named 'data' in the 'user_dir.' 

## Release Notes

### V1

Initial release of webActivities. Basic web activity capture in the background while the user is using Google Chrome. If the user chooses to pin the extension, there will be options that allow the user to choose which tab to be recorded or not. The data will be updated as the user unfocuses from any Chrome window.

### V1.x

Updated webActivites to be compatible with both MacOS and Windows by utilizing local node server instead of native messaging. Update speed may be slightly affected depending on the size of data and workload of local server.

## Contact

p.tri@wustl.edu

**Thanks and enjoy!**