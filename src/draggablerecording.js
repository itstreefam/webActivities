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

    componentDidMount() {
        // Initial positioning in the center
        const initialX = (window.innerWidth - this.div.offsetWidth) / 2;
        this.setState({ pos: { x: initialX, y: this.state.pos.y } });
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
  
    onMouseUp = (e) => {
        this.setState({ dragging: false });
        e.stopPropagation();
        e.preventDefault();
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
    width: '125px',
    height: '50px',
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

// Create a functional component for recording bar
const DraggableRecordingBar = () => {
    return (
        <Draggable
            initialPos={{ x: 0, y: 0 }}
            className='my-draggable'
            style = {draggableStyle}
        >
            <div style={textStyle}>🔴 Tab is recording</div>
            <div style={buttonsContainerStyle}>
                <button style={buttonStyle}>Stop</button>
                <button style={buttonStyle} onClick={hideDraggableRecordingBar}>Hide</button>
            </div>
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
