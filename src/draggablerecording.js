import React from 'react';
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
        const boxWidth = this.div.offsetWidth;
        const maxRight = window.innerWidth - boxWidth;

        // Constrain newX to the viewport
        newX = Math.max(0, newX); // Prevents moving beyond the left edge
        newX = Math.min(maxRight, newX); // Prevents moving beyond the right edge

        this.setState({
            pos: {
                x: newX,
                y: this.state.pos.y // The y position is not changed
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
    const draggableRecording = document.getElementById('draggable-recording');
    if (draggableRecording) {
        draggableRecording.style.display = 'none';
    }
}

const draggableStyle = {
    position: 'fixed',
    zIndex: 2147483647,
    backgroundColor: 'green',
    color: 'white',
    padding: '10px',
    borderRadius: '8px',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
    width: '125px !important',
    height: '50px !important',
    display: 'flex',
    flexDirection: 'column', // Stack children vertically
    alignItems: 'center', // Center children horizontally
};

const textStyle = {
    color: 'white',
    marginBottom: '8px', // Space between text and buttons
};
  
const buttonsContainerStyle = {
    display: 'flex', // Align buttons next to each other
};
  
const buttonStyle = {
    backgroundColor: 'white',
    color: 'black',
    border: 'none',
    padding: '5px',
    margin: '0 4px', // Space between buttons
    cursor: 'pointer',
};

const DraggableRecordingBar = ({ isRecording, toggleRecording }) => {
    const buttonText = isRecording ? 'Stop' : 'Start';
    const barColor = isRecording ? 'green' : 'purple';

    return (
        <Draggable
            initialPos={{ x: 0, y: 0 }}
            className='my-draggable'
            style={{ ...draggableStyle, backgroundColor: barColor }}
        >
            <div style={textStyle}>{isRecording ? '🔴 Tab is recording' : 'Tab is not recording'}</div>
            <div style={buttonsContainerStyle}>
                <button style={buttonStyle} onClick={toggleRecording}>{buttonText}</button>
                <button style={buttonStyle} onClick={hideDraggableRecordingBar}>Hide</button>
            </div>
        </Draggable>
    );
};

async function toggleRecording() {
    const latestTabInfo = await readLocalStorage('latestTab');
    const tabInfo = await readLocalStorage(latestTabInfo.curId.toString());

    if (tabInfo && tabInfo.recording) {
        await chrome.runtime.sendMessage({action: "stopRecording", tabId: latestTabInfo.curId});
    } else {
        await chrome.runtime.sendMessage({action: "startRecording", tabId: latestTabInfo.curId});
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

window.onload = async function() {
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
