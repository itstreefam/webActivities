import React, { createElement } from 'react';
import { createRoot } from 'react-dom/client';
// import Draggable from 'react-draggable';
import navigationDB from './navigationdb';
const db = navigationDB.db;
let root;

async function writeLocalStorage(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}
async function readLocalStorage(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => resolve(result[key]));
    });
}
async function getCurrentTabInfo() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
            resolve(response.tab);
        });
    });
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
        // Use a global key for position to persist across all tabs
        const savedPosKey = 'draggablePosition';
        const savedPos = await readLocalStorage(savedPosKey);

        const initialX = savedPos ? savedPos.x : (window.innerWidth - this.div.offsetWidth) / 2;
        const initialY = savedPos ? savedPos.y : this.state.pos.y;

        this.setState({ pos: { x: initialX, y: initialY } });
        window.addEventListener('resize', this.handleResize);
    }

    handleResize = () => {
        const { x, y } = this.state.pos;
        if (!this.div) return;
        const boxWidth = this.div.offsetWidth;
        const boxHeight = this.div.offsetHeight;
        const maxRight = window.innerWidth - boxWidth;
        const maxBottom = window.innerHeight - boxHeight;

        const newX = x > maxRight ? maxRight : x;
        const newY = y > maxBottom ? maxBottom : y;

        if (newX !== x || newY !== y) {
            this.setState({ pos: { x: newX, y: newY } });
        }
    }

    onMouseDown = (e) => {
        if (e.button !== 0) return;
        const pos = this.div.getBoundingClientRect();
        this.setState({
            dragging: true,
            rel: {
                x: e.pageX - pos.left,
                y: e.pageY - pos.top
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
        // Save to the global key
        await writeLocalStorage('draggablePosition', position);
    };

    onMouseMove = (e) => {
        if (!this.state.dragging) return;

        const boxWidth = this.div.offsetWidth;
        const maxRight = window.innerWidth - boxWidth;
        let newX = e.pageX - this.state.rel.x;
        newX = Math.max(0, newX);
        newX = Math.min(maxRight, newX);

        const boxHeight = this.div.offsetHeight;
        const maxBottom = window.innerHeight - boxHeight;
        let newY = e.pageY - this.state.rel.y;
        newY = Math.max(0, newY);
        newY = Math.min(maxBottom, newY);

        this.setState({
            pos: { x: newX, y: newY }
        });
        e.stopPropagation();
        e.preventDefault();
    };

   render() {
        return (
            <div
                onMouseDown={this.onMouseDown}
                style={{
                    position: 'fixed',
                    left: this.state.pos.x + 'px',
                    top: this.state.pos.y + 'px',
                    ...this.props.style
                }}
                ref={div => { this.div = div; }}
            >
                {this.props.children}
            </div>
        );
    }
}

async function hideDraggableRecordingBar() {
    const draggableRecording = document.getElementById('notHidingState');
    if (draggableRecording) {
        draggableRecording.style.display = 'none';
    }
    const dot = document.getElementById('dot');
    if (dot) {
        dot.style.display = 'flex';
    }
    await writeLocalStorage('draggableIsHidden', true); // Save hidden state
}

async function unhide() {
    const draggableRecording = document.getElementById('notHidingState');
    if (draggableRecording) {
        draggableRecording.style.display = 'flex';
    }
    const dot = document.getElementById('dot');
    if (dot) {
        dot.style.display = 'none';
    }
    await writeLocalStorage('draggableIsHidden', false); // Save visible state
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
    position: 'fixed', // Ensure it's fixed relative to the viewport
    zIndex: 2147483647,
    backgroundColor: 'green',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '8px',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
};

const textStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
};

const buttonsContainerStyle = {
    display: 'flex',
    gap: '5px',
};

const tabSummaryStyle = {
    flex: 1, // Allow this item to grow and fill available space
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
    borderRadius: '50%',
    display: 'hidden',
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '10px',
};

const recordingText = {
    float: 'left',
    margin: '3px',
    whiteSpace: 'nowrap',
};

const summaryContainerStyle = {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    gap: '10px',
    marginTop: '8px',
};

const totalSummaryStyle = {
    flex: 1, // Allow this item to grow and fill available space
};

const dropDown = {
    width: '100%',
    marginTop: '5px',
};

const notHidingStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
};

const recordingBorderStyle = {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: 2147483646,
    pointerEvents: 'none',
    boxSizing: 'border-box',
    border: '3px solid green', 
    opacity: '0',
    transition: 'opacity 0.4s ease-in-out',
};

const recordingBorderActiveStyle = {
    opacity: '1',
};

const RecordingBorder = ({ isRecording }) => {
    const style = isRecording 
        ? { ...recordingBorderStyle, ...recordingBorderActiveStyle }
        : recordingBorderStyle;
    return <div style={style} />;
};

const DraggableRecordingBar = ({ isRecording, toggleRecording }) => {
    const buttonText = isRecording ? 'Stop' : 'Start';
    const barColor = isRecording ? 'green' : '#e2711d';

    return (
        <> {/* Use a React Fragment to return multiple elements */}
        <RecordingBorder isRecording={isRecording} />
        <Draggable
            initialPos={{ x: 0, y: 0 }}
            className='my-draggable'
            style={{ ...draggableStyle, backgroundColor: barColor }}
        >
            <div id={"notHidingState"} style={notHidingStyle}>
                <div style={textStyle}>
                    <div style={recordingText}>
                        {isRecording ? 'Tab is recording' : 'Tab is not recording'}
                    </div>
                    <div style={buttonsContainerStyle}>
                        <button style={buttonStyle} onClick={toggleRecording}>{buttonText}</button>
                        <button style={buttonStyle} onClick={hideDraggableRecordingBar}>Minimize</button>
                    </div>
                </div>

                 <div style={summaryContainerStyle}>
                    {/* Uncomment to show Tab Summary. It will now take up half the space. */}
                    {/*
                    <div style={tabSummaryStyle}>
                        <button style={buttonStyle} onClick={showTabSummary}>Tab Summary</button>
                        <div style={dropDown} id={"recordedTabNames"}>
                        </div>
                    </div>
                    */}
                    
                    {/* If you comment this out, the other one will take up the full width. */}
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
        </>
    );
};

async function toggleRecording() {
    const latestTabInfo = await readLocalStorage('latestTab');
    let tabInfo = await readLocalStorage(latestTabInfo.curId.toString());

    tabInfo.recording = !tabInfo.recording;
    tabInfo.action = replaceTextInParentheses(tabInfo.action, tabInfo.recording ? 'recording on' : 'recording off');

    await writeLocalStorage(latestTabInfo.curId.toString(), tabInfo);
    await chrome.runtime.sendMessage({ action: 'toggleRecording', update: tabInfo, curId: latestTabInfo.curId });

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

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === "updateRecording") {
            console.log('updateRecording message received');
            updateUI(request.recording);
        }
    });

    // Determine recording status
    const latestTabInfo = await readLocalStorage('latestTab');
    let isRecording = false;
    if (latestTabInfo && latestTabInfo.curId) {
        const tabInfo = await readLocalStorage(latestTabInfo.curId.toString());
        isRecording = tabInfo ? tabInfo.recording : false;
    }
    
    // Initial UI render
    await updateUI(isRecording);

    // Check and apply the hidden state after the UI has rendered
    const isHidden = await readLocalStorage('draggableIsHidden');
    if (isHidden) {
        // Use a small timeout to ensure the DOM elements are available
        setTimeout(hideDraggableRecordingBar, 100);
    }
};
