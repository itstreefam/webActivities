import React, { createElement } from 'react';
import { createRoot } from 'react-dom/client';
// import Draggable from 'react-draggable';
import navigationDB from './navigationdb';
const db = navigationDB.db;
let root;

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

let isHistoryShown = false;
async function showHistory() {
    const historyContainer = document.getElementById('recordedNames');

    // Toggle visibility if data is already processed
    if (isHistoryShown) {
        historyContainer.style.display = historyContainer.style.display === 'none' ? 'block' : 'none';
        return;
    }

    let tableData = await readLocalStorage('tableData');
    if (typeof tableData === 'undefined') {
        console.log("Table data is undefined");
        return;
    }

    if (tableData.length > 0) {
        console.log("exporting data to user's working project folder");

        let titleCounts = {};

        // Map over the data, removing the 'recording' key and count titles
        let copyData = tableData.map(el => {
            if (el.recording === true) delete el.recording;

           titleCounts[el.curTitle] = titleCounts[el.curTitle] ? titleCounts[el.curTitle] + 1 : 1;
            return el;
        });

        // Clear the container before appending new items
        historyContainer.innerHTML = '';

        // Create elements for each unique title and append to the container
        for (let title in titleCounts) {
            const titleElement = document.createElement("p");
            titleElement.innerText = `${title} (${titleCounts[title]})`;
            historyContainer.appendChild(titleElement);
            console.log("test name!!!!! ", `${title} (${titleCounts[title]})`);
        }

        isHistoryShown = true; // Set visible state to true after first processing
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
    let tabInfo = await readLocalStorage(latestTabInfo.curId.toString());

    // Update the local storage with the new state
    let before = tabInfo.recording;
    tabInfo.recording = !before;
    let after = tabInfo.recording;

    if(before == false && after == true){
        tabInfo.action = replaceTextInParentheses(tabInfo.action, 'recording on');
    } else if(before == true && after == false){
        tabInfo.action = replaceTextInParentheses(tabInfo.action, 'recording off');
    }


    await writeLocalStorage(latestTabInfo.curId.toString(), tabInfo);
    
    await chrome.runtime.sendMessage({ action: 'toggleRecording', update: tabInfo, curId: latestTabInfo.curId });

    // Update UI
    updateUI(tabInfo.recording);
}

function replaceTextInParentheses(text, replacement) {
    // Check if the text contains parentheses
    if (text.includes('(') && text.includes(')')) {
        // Use a regular expression to match text within parentheses
        return text.replace(/\(.*?\)/g, `(${replacement})`);
    }
    // Return the original text + (replacement)
    return `${text} (${replacement})`
}

async function updateUI(isRecording) {
    const mountNode = document.getElementById('draggable-recording') || document.createElement('div');
    if (!mountNode.id) {
        mountNode.id = 'draggable-recording';
        document.body.appendChild(mountNode);
    }

    if(!root){
        root = createRoot(mountNode);
    }
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

