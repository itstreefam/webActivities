# webActivities

A Google Chrome extension that aims to capture the information needed to generate usable code histories (capturing web search activity).

## Demo

https://user-images.githubusercontent.com/44308446/172105979-db968538-7b7b-4aff-9f90-aee86a1c672d.mp4

## Requirements

* Python version 2 or 3 to run background script that transfers web search data to a local user directory

## Extension Settings

Clone this repository and load it on Google Chrome by visiting chrome://extensions/, turning on Developer mode, and choosing the option Load unpacked.

Once the extension is loaded, copy and paste its ID to the placeholder in host/savedat.json. When done, double click install_host.bat to enable the system host connection for transferring the data from Google Chrome to the system host that will then write the data to a file named 'data' in an assigned user working directory.

The assigned user working directory should be determined beforehand by updating the variable 'user_project_directory' in host/save-url-data.py with a folder path that the user plans to perform their tasks on.

## Release Notes

### V1

Initial release of webActivities. Basic web activity capture in the background while the user is using Google Chrome. The data will be consistently updated as the user unfocuses from any Chrome window.

## Contact

p.tri@wustl.edu

**Thanks and enjoy!**