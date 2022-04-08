#!/usr/bin/env python

import sys
import struct
import os
import msvcrt

# On Windows, the default I/O mode is O_TEXT. Set this to O_BINARY
# to avoid unwanted modifications of the input/output streams.
if sys.platform == "win32":
    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

user_project_directory = os.path.normpath(r'C:\path\to\user\project')

try:
    # Python 3.x version
    # Read a message from stdin and decode it.
    def getMessage():
        rawLength = sys.stdin.buffer.read(4)
        if len(rawLength) == 0:
            sys.exit(0)
        messageLength = struct.unpack('@I', rawLength)[0]
        message = sys.stdin.buffer.read(messageLength).decode('utf-8')
        return message

    while True:
        receivedMessage = getMessage()
        # remove the first 8 characters and last 2 characters
        # since we only wants ... in {"text": "..."}
        receivedMessage = receivedMessage[9:-2]
        # if user_project_directory already has data
        if os.path.join(user_project_directory, 'data') not in os.listdir(user_project_directory):
            with open(os.path.join(user_project_directory, 'data'), 'w') as f:
                f.write(receivedMessage.replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r').replace('\\"', '"'))
                f.close()
        else:
            with open(os.path.join(user_project_directory, 'data'), 'x') as f:
                f.write(receivedMessage.replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r').replace('\\"', '"'))
                f.close()
        
except AttributeError:
    # Python 2.x version (if sys.stdin.buffer is not defined)
    # Read a message from stdin and decode it.
    def getMessage():
        rawLength = sys.stdin.read(4)
        if len(rawLength) == 0:
            sys.exit(0)
        messageLength = struct.unpack('@I', rawLength)[0]
        message = sys.stdin.read(messageLength)
        return message

    while True:
        receivedMessage = getMessage()
        # remove the first 8 characters and last 2 characters
        receivedMessage = receivedMessage[9:-2]
        # if user_project_directory already has data
        if os.path.join(user_project_directory, 'data') not in os.listdir(user_project_directory):
            with open(os.path.join(user_project_directory, 'data'), 'w') as f:
                f.write(receivedMessage.replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r').replace('\\"', '"'))
                f.close()
        else:
            with open(os.path.join(user_project_directory, 'data'), 'x') as f:
                f.write(receivedMessage.replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r').replace('\\"', '"'))
                f.close()