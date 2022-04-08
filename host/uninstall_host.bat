:: Deletes the entry created by install_host.bat
REG DELETE "HKCU\Software\Google\Chrome\NativeMessagingHosts\savedat" /f
REG DELETE "HKLM\Software\Google\Chrome\NativeMessagingHosts\savedat" /f