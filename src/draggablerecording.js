import React from 'react';
import { createRoot } from 'react-dom/client';
import Draggable from 'react-draggable';

const draggableStyle = {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    zIndex: 2147483647,
    backgroundColor: 'green',
    color: 'white',
    padding: '10px',
    borderRadius: '8px',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
};

// Create a functional component for recording bar
const DraggableRecordingBar = () => {
    return (
        <Draggable>
            <div style={draggableStyle}>
                <div>🔴 You are screen sharing</div>
                <button >
                    Stop Share
                </button>
            </div>
      </Draggable>
    );
};

window.onload = function() {
    console.log('Hello from DraggableRecording.js');

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.message === "testDraggable") {
            console.log('testDraggable message received');
            const mountNode = document.createElement('div');
            mountNode.id = 'draggable-recording';
            document.body.appendChild(mountNode);

            // Use createRoot to render the component
            const root = createRoot(mountNode);
            root.render(<DraggableRecordingBar />);
        }
    });
};
