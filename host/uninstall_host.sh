#!/bin/sh
# https://github.com/GoogleChrome/chrome-extensions-samples/blob/main/mv2-archive/api/nativeMessaging/host/uninstall_host.sh
set -e

if [ "$(uname -s)" = "Darwin" ]; then
  if [ "$(whoami)" = "root" ]; then
    TARGET_DIR="/Library/Google/Chrome/NativeMessagingHosts"
  else
    TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  fi
else
  if [ "$(whoami)" = "root" ]; then
    TARGET_DIR="/etc/opt/chrome/native-messaging-hosts"
  else
    TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
  fi
fi

HOST_NAME=savedat
rm "$TARGET_DIR/savedat.json"
echo "Native messaging host $HOST_NAME has been uninstalled."