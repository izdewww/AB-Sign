#ifndef AppVersion
  #error AppVersion must come from package.json.
#endif
#ifndef PackagedApp
  #error PackagedApp must point to the Windows x64 Electron package.
#endif

#define AppName "A-B Sign!"
#define AppExe "ab-sign.exe"
#define AppWebsite "https://github.com/izdewww/AB-Sign"

[Setup]
AppId={{4C944783-6A31-4871-AB2D-A56A9D8DF4F3}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppName}
AppPublisherURL={#AppWebsite}
AppSupportURL={#AppWebsite}/issues
VersionInfoProductName={#AppName}
VersionInfoDescription=A-B Sign! Windows Installer
VersionInfoVersion={#AppVersion}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\A-B Sign
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes
WizardStyle=modern dynamic
SetupIconFile=..\src\renderer\public\ab-sign.ico
WizardSmallImageFile=wizard-logo.png
OutputDir=..\out\installer
OutputBaseFilename=A-B-Sign-Setup-{#AppVersion}-x64
Compression=lzma2/fast
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExe}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "{#PackagedApp}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "Open {#AppName}"; Flags: nowait postinstall skipifsilent unchecked
