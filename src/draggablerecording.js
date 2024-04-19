import React, { createElement } from 'react';
import { createRoot } from 'react-dom/client';
// import Draggable from 'react-draggable';
import Dexie from 'dexie';

const db = new Dexie('NavigationDatabase');
db.version(1).stores({
    navigationTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img',
    navigationHistoryTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img'
});

// Check if a tab info record exists in history
async function tabInfoExistsInHistory(curTabId) {
    const count = await db.navigationHistoryTable.where('curTabId').equals(curTabId).count();
    return count > 0;
}

// Update tab info based on curTabId
async function updateTabInfoByCurTabId(curTabId, updates) {
    try {
        await db.navigationTable.where('curTabId').equals(curTabId).modify(updates);
        if (updates.recording === true) {
            let tabInfoExistsInDb = await tabInfoExistsInHistory(curTabId);
            if (!tabInfoExistsInDb) {
                await db.navigationHistoryTable.add(updates);
            } else {
                await db.navigationHistoryTable.where('curTabId').equals(curTabId).modify(updates);
            }
        }
        console.log(`Tab info with curTabId ${curTabId} updated successfully.`);
    } catch (error) {
        console.error(`Failed to update tab info with curTabId ${curTabId}:`, error);
    }
}

async function getCurrentTabInfo() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getCurrentTab' });
        if (typeof response.tab === 'string') {
            // Only parse if it's a string
            const tabInfo = JSON.parse(response.tab);
            console.log('Current tab info:', tabInfo);
            return tabInfo;
        } else {
            // If it's already an object, just return it
            console.log('Current tab info:', response.tab);
            return response.tab;
        }
    } catch (error) {
        console.error('Error getting current tab info:', error);
        return null;
    }
}

// https://stackoverflow.com/questions/20926551/recommended-way-of-making-react-component-div-draggable
class Draggable extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            pos: this.props.initialPos,
            dragging: false,
            rel: null // position relative to the cursor
        };
    }

    componentDidUpdate(props, state) {
        if (this.state.dragging && !state.dragging) {
            document.addEventListener('mousemove', this.onMouseMove);
            document.addEventListener('mouseup', this.onMouseUp);
        } else if (!this.state.dragging && state.dragging) {
            document.removeEventListener('mousemove', this.onMouseMove);
            document.removeEventListener('mouseup', this.onMouseUp);
        }
    }

    async componentDidMount() {
        const tabInfo = await getCurrentTabInfo();
        const curTabId = tabInfo.id;
        const savedPosKey = `draggablePosition ${curTabId}`;

        const savedPos = await readLocalStorage(savedPosKey);

        const initialX = savedPos ? savedPos.x : (window.innerWidth - this.div.offsetWidth) / 2;
        const initialY = savedPos ? savedPos.y : this.state.pos.y;

        this.setState({ pos: { x: initialX, y: initialY } });
        window.addEventListener('resize', this.handleResize);
    }

    handleResize = () => {
        // Adjust the position if it's out of the viewport after a resize
        const currentX = this.state.pos.x;
        const boxWidth = this.div.offsetWidth;
        const maxRight = window.innerWidth - boxWidth;

        if (currentX > maxRight) {
            this.setState({ pos: { x: maxRight, y: this.state.pos.y } });
        }
    }

    onMouseDown = (e) => {
        // only left mouse button
        if (e.button !== 0) return;
        const pos = this.div.getBoundingClientRect();
        this.offset = e.clientX - pos.left;
        this.setState({
            dragging: true,
            rel: {
                x: e.pageX - pos.left
            }
        });
        e.stopPropagation();
        e.preventDefault();
    };

    onMouseUp = async (e) => {
        this.setState({ dragging: false });
        e.stopPropagation();
        e.preventDefault();

        const position = { x: this.state.pos.x, y: this.state.pos.y };

        const tabInfo = await getCurrentTabInfo();
        const curTabId = tabInfo.id;

        await writeLocalStorage(`draggablePosition ${curTabId}`, position);
    };

    onMouseMove = (e) => {
        if (!this.state.dragging) return;

        let newX = e.clientX - this.state.rel.x;
        let newY = e.clientY - this.state.rel.y;
        const boxWidth = this.div.offsetWidth;
        const maxRight = window.innerWidth - boxWidth;

        // Constrain newX to the viewport
        newX = Math.max(0, newX); // Prevents moving beyond the left edge
        newX = Math.min(maxRight, newX); // Prevents moving beyond the right edge

        this.setState({
            pos: {
                x: newX,
                y: newY // try changing Y
            }
        });
        e.stopPropagation();
        e.preventDefault();
    };

    render() {
        return (
            <div
                onMouseDown={this.onMouseDown}
                style={{
                    position: 'absolute',
                    left: this.state.pos.x + 'px',
                    top: this.state.pos.y + 'px',
                    ...this.props.style // spread the styles from props
                }}
                ref={div => { this.div = div; }}
            >
                {this.props.children}
            </div>
        );
    }
}

function hideDraggableRecordingBar() {
    const draggableRecording = document.getElementById('notHidingState');
    if (draggableRecording) {
        draggableRecording.style.display = 'none';
    }
    const dot = document.getElementById('dot');
    if (dot) {
        dot.style.display = 'flex';
    }
}

function unhide() {
    const draggableRecording = document.getElementById('notHidingState');
    if (draggableRecording) {
        draggableRecording.style.display = 'flex';
    }
    const dot = document.getElementById('dot');
    if (dot) {
        dot.style.display = 'none';
    }
}

async function showHistory() {
    // show history: ask Tri how to get the data
    let tableData = await readLocalStorage('tableData');
    if (typeof tableData === 'undefined') {
        console.log("Table data is undefined");
        return;
    }

    if (tableData.length > 0) {
        console.log("exporting data to user's working project folder");
        let copyData = tableData;

        // remove the 'recording' keys from the newData
        copyData = copyData.map(el => {
            if (el.recording === true) delete el.recording
            return el;
        });

        let result = JSON.stringify(copyData, undefined, 4);
        // await websocketSendData(result);
        var stringify = JSON.parse(result);
        for (var i = 0; i < stringify.length; i++) {
            const title = document.createElement("p");
            title.innerText = stringify[i]['curTitle'];
            document.getElementById("recordedNames").appendChild(title);
            console.log("test name!!!!! ", stringify[i]['curTitle']);
        }
        console.log("Table data:", result);
    }

}

async function showTabSummary() {
    let tableData = await readLocalStorage('tableData');
    if (typeof tableData === 'undefined') {
        console.log("Table data is undefined");
        return;
    }

    if (tableData.length > 0) {
        console.log("exporting data to user's working project folder");
        let copyData = tableData;

        // remove the 'recording' keys from the newData
        copyData = copyData.map(el => {
            if (el.recording === true) delete el.recording
            return el;
        });

        let result = JSON.stringify(copyData, undefined, 4);
        // await websocketSendData(result);
        var stringify = JSON.parse(result);
        const tabInfo = await getCurrentTabInfo();
        const curTabId = tabInfo.id;
        for (var i = 0; i < stringify.length; i++) {
            if (curTabId === stringify[i]['curTabId']) {
                const title = document.createElement("p");
                title.innerText = stringify[i]['curTitle'];
                document.getElementById("recordedTabNames").appendChild(title);
                console.log("test tab names only!!!!! ", stringify[i]['curTitle']);
            }

        }
        console.log("Table data:", result);
    }
}

const draggableStyle = {
    position: 'absolute',
    zIndex: 2147483647,
    backgroundColor: 'green',
    outline: 'auto',
    opacity: '0.9',
    color: 'black',
    fontSize: '12px',
    padding: '10px',
    borderRadius: '10px',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
    //width: '125px !important',
    //minWidth: '125px !important',
    //height: '50px !important',
    //minHeight: '50px !important',
    display: 'flex',
    //flexDirection: 'column', // Stack children vertically
    alignItems: 'center', // Center children horizontally
};

const textStyle = {
    color: 'white',
    fontSize: '15px',
    flexDirection: 'row',
    // marginBottom: '8px', // Space between text and buttons
};

const buttonsContainerStyle = {
    display: 'flex', // Align buttons next to each other
};

const tabSummaryStyle = {
    float: 'left',
    width: '46%',
    marginTop: '10px',

};

const buttonStyle = {
    backgroundColor: 'white',
    color: 'black',
    border: 'none',
    padding: '5px',
    margin: '0 4px', // Space between buttons
    cursor: 'pointer',
    borderRadius: '10px',
    opacity: '90%,',
    fontSize: '14px',
};

const hideDot = {
    height: '25px',
    width: '25px',
    backgroundcolor: 'black',
    borderRadius: '50%',
    display: 'hidden',
}

const recordingText = {
    float: 'left',
    margin: '3px',
}

const summaryContainerStyle = {
    alignItems: 'center',
    flexDirection: 'row',
}

const totalSummaryStyle = {
    width: '54%',
    float: 'left',
    marginTop: '10px',
}

const dropDown = {
    width: '100%',
}

const notHidingStyle = {
    width: '125px !important',
    minWidth: '125px !important',
    height: '50px !important',
    minHeight: '50px !important',
    flexDirection: 'column',
}

const DraggableRecordingBar = ({ isRecording, toggleRecording }) => {
    const buttonText = isRecording ? 'Stop' : 'Start';
    const barColor = isRecording ? 'green' : '#e2711d';

    return (
        <Draggable
            initialPos={{ x: 0, y: 0 }}
            className='my-draggable'
            style={{ ...draggableStyle, backgroundColor: barColor }}
        >
            <div id={"notHidingState"} style={notHidingStyle}>
                <div style={textStyle}>
                    <div style={recordingText}>
                        {isRecording ? '🔴 Tab is recording' : 'Tab is not recording'}
                    </div>
                    <div style={buttonsContainerStyle}>
                        <button style={buttonStyle} onClick={toggleRecording}>{buttonText}</button>
                        <button style={buttonStyle} onClick={hideDraggableRecordingBar}>Hide</button>
                    </div>
                </div>

                <div style={summaryContainerStyle}>
                    <div style={tabSummaryStyle}>
                        <button style={buttonStyle} onClick={showTabSummary}>Tab Summary</button>
                        <div style={dropDown} id={"recordedTabNames"}>
                        </div>
                    </div>
                    <div style={totalSummaryStyle}>
                        <button style={buttonStyle} onClick={showHistory}>Total Recording</button>
                        <div style={dropDown} id={"recordedNames"}>
                        </div>
                    </div>
                </div>
            </div>
            <span id={"dot"} style={hideDot} onClick={unhide}>
            </span>
        </Draggable>
    );
};

async function toggleRecording() {
    const latestTabInfo = await readLocalStorage('latestTab');
    const tabInfo = await readLocalStorage(latestTabInfo.curId.toString());

    if (tabInfo && tabInfo.recording) {
        await chrome.runtime.sendMessage({ action: "stopRecording", tabId: latestTabInfo.curId });
    } else {
        await chrome.runtime.sendMessage({ action: "startRecording", tabId: latestTabInfo.curId });
    }

    // Update the local storage with the new state
    tabInfo.recording = !tabInfo.recording;
    await writeLocalStorage(latestTabInfo.curId.toString(), tabInfo);
    await updateTabInfoByCurTabId(latestTabInfo.curId, tabInfo);

    // Update UI
    updateUI(tabInfo.recording);
}

async function updateUI(isRecording) {
    const mountNode = document.getElementById('draggable-recording') || document.createElement('div');
    if (!mountNode.id) mountNode.id = 'draggable-recording';
    document.body.appendChild(mountNode);

    const root = createRoot(mountNode);
    root.render(<DraggableRecordingBar isRecording={isRecording} toggleRecording={toggleRecording} />);
}

window.onload = async function () {
    console.log('Hello from DraggableRecording.js');

    await chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.message === "testDraggable") {
            console.log('testDraggable message received');
            if (!document.getElementById('draggable-recording')) { // Check if element already exists
                const mountNode = document.createElement('div');
                mountNode.id = 'draggable-recording';
                document.body.appendChild(mountNode);

                // Use createRoot to render the component
                const root = createRoot(mountNode);
                root.render(<DraggableRecordingBar />);
            } else {
                const draggableRecording = document.getElementById('draggable-recording');
                draggableRecording.style.display = 'block';
            }
        }

        if (request.action === "updateRecording") {
            console.log('updateRecording message received');
            updateUI(request.recording);
        }
    });

    // get the current tab
    const latestTabInfo = await readLocalStorage('latestTab');
    const tabInfo = await readLocalStorage(latestTabInfo.curId.toString());
    const isRecording = tabInfo ? tabInfo.recording : false;

    updateUI(isRecording);
};

// Sets a key and stores its value into the storage
async function writeLocalStorage(key, value) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, function () {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message);
            } else {
                resolve();
            }
        });
    });
}

// Gets a key value from the storage
async function readLocalStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], function (result) {
            if (result[key] === undefined) {
                console.log("Key not found in chrome storage");
                resolve(undefined);
            } else {
                resolve(result[key]);
            }
        });
    });
}

//do the training part first and then set up 
//https://myirb.wusm.wustl.edu/
//https://hrpo.wustl.edu/training/human-subjects-education-citi/   <- do this first 

