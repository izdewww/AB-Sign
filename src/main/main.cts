import { app, BrowserWindow, nativeImage, net, protocol, session } from 'electron';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyDesktop } from './smoke.cjs';

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
  const window = new BrowserWindow({
    title: 'A-B Sign!', width: 1280, height: 900, minWidth: 800, minHeight: 600,
    icon,
    show: !smoke,
    webPreferences: {
      session: browserSession, sandbox: true, contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: !(smoke && process.env.AB_SIGN_SMOKE_DIR),
    },
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
    if (icon.isEmpty()) throw new Error('The desktop logo did not load.');
    await verifyDesktop(window);
    app.exit(0);
  }
}).catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});

app.on('window-all-closed', () => app.quit());
