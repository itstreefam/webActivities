import React from 'react';
import { createRoot } from 'react-dom/client';
import Draggable from 'react-draggable';

class App extends React.Component {
    render() {
        return (
            <Draggable>
                <div style={{ padding: '10px', background: 'green', cursor: 'pointer', position: 'fixed', top: '50px', left: '50px' }}>
                    <p style={{ color: 'gray' }}>Recording</p>
                </div>
            </Draggable>
        );
    }
}

window.onload = function() {
    console.log('Hello from DraggableRecording.js');

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.message === "testDraggable") {
            console.log('testDraggable message received');
            const mountNode = document.createElement('div');
            mountNode.id = 'draggable-recording';
            mountNode.style.zIndex = '9999';
            document.body.appendChild(mountNode);

            // Use createRoot to render the component
            const root = createRoot(mountNode); // Create a root for the component.
            root.render(<App />); // Render the component.
        }
    });
};
