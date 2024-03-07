import React from 'react';
import { createRoot } from 'react-dom/client';
// import Draggable from 'react-draggable';

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
  
    onMouseDown = (e) => {
        // only left mouse button
        if (e.button !== 0) return;
        const pos = this.div.getBoundingClientRect();
        this.setState({
            dragging: true,
            rel: {
                x: e.clientX - pos.left,
                y: e.clientY - pos.top
            }
        });
        e.stopPropagation();
        e.preventDefault();
    };
  
    onMouseUp = (e) => {
        this.setState({ dragging: false });
        e.stopPropagation();
        e.preventDefault();
    };
  
    onMouseMove = (e) => {
        if (!this.state.dragging) return;
        this.setState({
            pos: {
                x: e.clientX - this.state.rel.x,
                y: e.clientY - this.state.rel.y
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
};

// Create a functional component for recording bar
const DraggableRecordingBar = () => {
    return (
        <Draggable
            initialPos={{ x: 100, y: 200 }}
            className='my-draggable'
            style = {draggableStyle}
        >
            <div>🔴 You are screen sharing</div>
            <button > Stop Share </button>
            <button onClick={hideDraggableRecordingBar} > Hide </button>
      </Draggable>
    );
};

window.onload = function() {
    console.log('Hello from DraggableRecording.js');

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
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
    });
};
