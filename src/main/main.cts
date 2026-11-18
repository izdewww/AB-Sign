import { app, BrowserWindow, net, protocol, session } from 'electron';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const page = 'app://local/';
const smoke = process.argv.includes('--smoke-test');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

app.whenReady().then(async () => {
  const root = resolve(app.getAppPath(), 'dist');
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'local' || request.method !== 'GET') return new Response(null, { status: 404 });

    try {
      const pathname = decodeURIComponent(url.pathname);
      const file = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
      if (!file.startsWith(root + sep)) return new Response(null, { status: 404 });
      const result = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(result.headers);
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'");
      return new Response(result.body, { status: result.status, headers });
    } catch {
      return new Response(null, { status: 404 });
    }
  });

  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, respond) => respond(false));
  const window = new BrowserWindow({
    title: 'A-B Sign!', width: 1280, height: 900, minWidth: 800, minHeight: 600,
    show: !smoke,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  await window.loadURL(page);

  if (smoke) {
    const ready = await window.webContents.executeJavaScript(`new Promise(resolve => {
      const end = Date.now() + 5000;
      const timer = setInterval(() => {
        const heading = document.querySelector('h1')?.textContent === 'A-B Sign!';
        if (heading || Date.now() > end) { clearInterval(timer); resolve(heading); }
      }, 25);
    })`);
    const asset = await window.webContents.executeJavaScript(`fetch('/vision/fsl-abc-v1.task', {method:'GET'}).then(r => r.ok && r.arrayBuffer()).then(b => b.byteLength > 0)`);
    if (!ready || !asset) throw new Error('The desktop renderer or packaged model did not load.');
    console.log('Desktop renderer and local model asset loaded.');
    app.exit(0);
  }
}).catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});

app.on('window-all-closed', () => app.quit());
