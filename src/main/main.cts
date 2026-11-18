import { app, BrowserWindow, ipcMain, nativeImage, net, protocol, session } from 'electron';
import { resolve, sep } from 'node:path';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyDesktop } from './smoke.cjs';
import { localAccounts } from './accounts.cjs';

const page = 'app://local/';
const smoke = process.argv.includes('--smoke-test');
const ownsInstance = smoke || app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
if (smoke) app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

function isAppOrigin(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'app:' && url.host === 'local' && !url.username && !url.password;
  } catch {
    return false;
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

app.whenReady().then(async () => {
  if (!ownsInstance) return;
  app.setAppUserModelId('com.absign.desktop');
  const root = resolve(app.getAppPath(), 'dist');
  const browserSession = smoke ? session.fromPartition('desktop-smoke') : session.defaultSession;
  browserSession.protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'local' || request.method !== 'GET') return new Response(null, { status: 404 });

    try {
      const pathname = decodeURIComponent(url.pathname);
      const file = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
      if (!file.startsWith(root + sep)) return new Response(null, { status: 404 });
      const result = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(result.headers);
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; img-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'none'");
      return new Response(result.body, { status: result.status, headers });
    } catch {
      return new Response(null, { status: 404 });
    }
  });

  const icon = nativeImage.createFromPath(resolve(root, 'ab-sign.ico'));
  const fixtureDirectory = smoke ? mkdtempSync(resolve(app.getPath('temp'), 'ab-sign-smoke-')) : undefined;
  const accountsFile = resolve(fixtureDirectory ?? app.getPath('userData'), 'classroom-v1.json');
  const accounts = localAccounts(accountsFile);
  const window = new BrowserWindow({
    title: 'A-B Sign!', width: 1280, height: 900, minWidth: 800, minHeight: 600,
    icon,
    show: !smoke,
    webPreferences: {
      session: browserSession, sandbox: true, contextIsolation: true, nodeIntegration: false,
      preload: resolve(__dirname, 'preload.cjs'), devTools: !app.isPackaged || smoke,
      backgroundThrottling: !smoke,
    },
  });
  ipcMain.handle('ab-sign:accounts', (event, command) => {
    if (window.isDestroyed() || event.sender !== window.webContents || !event.senderFrame ||
      event.senderFrame !== window.webContents.mainFrame || !isAppOrigin(event.senderFrame.url)) {
      return { ok: false, error: 'Account access is unavailable.' };
    }
    return accounts(command);
  });
  browserSession.setPermissionCheckHandler((contents, permission, origin, details) =>
    contents === window.webContents && details.isMainFrame && isAppOrigin(origin) &&
    (permission === 'fullscreen' || (permission === 'media' && details.mediaType === 'video')));
  browserSession.setPermissionRequestHandler((contents, permission, respond, details) => {
    const request = details as Electron.MediaAccessPermissionRequest;
    respond(contents === window.webContents && request.isMainFrame && isAppOrigin(request.requestingUrl) &&
      (permission === 'fullscreen' || (permission === 'media' && request.mediaTypes?.length === 1 && request.mediaTypes[0] === 'video')));
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  await window.loadURL(page);

  if (smoke) {
    try {
      if (icon.isEmpty()) throw new Error('The desktop logo did not load.');
      await verifyDesktop(window);
      const reopened = localAccounts(accountsFile);
      const saved = reopened({ action: 'state' });
      if (!saved.ok || saved.state.active || saved.state.students.length !== 1 || saved.state.students[0].name !== 'Maya S') {
        throw new Error('The classroom file did not preserve the edited roster.');
      }
      if (reopened({ action: 'login', password: 'TeacherStart24!' }).ok ||
        !reopened({ action: 'login', password: 'ClassroomExample24!' }).ok) throw new Error('The new teacher password did not persist.');
      const student = reopened({ action: 'student-progress', id: saved.state.students[0].id });
      if (!student.ok || !student.progress?.badges.includes('numbers') || student.progress.attempts.length < 2) {
        throw new Error('Student quiz scores and badges did not persist.');
      }
    } finally {
      rmSync(accountsFile, { force: true });
      rmSync(accountsFile + '.tmp', { force: true });
      if (fixtureDirectory) rmdirSync(fixtureDirectory);
    }
    app.exit(0);
  }
}).catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});

app.on('window-all-closed', () => app.quit());
