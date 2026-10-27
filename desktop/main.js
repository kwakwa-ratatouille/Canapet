// Appli PC de Cana'pet : une fenêtre plein écran qui charge le site en ligne (donc toujours à jour).
// Sans internet, une page locale propose de réessayer (les manettes ont de toute façon besoin d'internet).
const { app, BrowserWindow, Menu, session, shell } = require('electron');
const path = require('path');

const SITE = 'https://kwakwa-ratatouille.github.io/Canapet/';
const TV = SITE + '#/tv';
const SMOKE = process.argv.includes('--smoke');

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function create() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: !SMOKE,
    show: !SMOKE,
    backgroundColor: '#ffd6ea',
    title: "Cana'pet",
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  Menu.setApplicationMenu(null);

  // Jamais de vieille version en cache : on redemande toujours la page au serveur.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Pragma'] = 'no-cache';
    details.requestHeaders['Cache-Control'] = 'no-cache';
    callback({ requestHeaders: details.requestHeaders });
  });

  const open = () => win.loadURL(TV, { extraHeaders: 'pragma: no-cache\n' });
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (isMain && code !== -3 && !url.startsWith('file:')) win.loadFile(path.join(__dirname, 'offline.html'));
  });
  // La page hors ligne demande un nouvel essai via « #retry ».
  win.webContents.on('did-navigate-in-page', (_e, url) => {
    if (/#retry/.test(url)) open();
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
    if (input.key === 'F5') {
      open();
      e.preventDefault();
    }
    if (input.key === 'F4' && input.alt) app.quit();
  });
  // Liens externes (aide, téléchargements) : dans le vrai navigateur.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (SMOKE) {
    // Test automatique : on charge la télé, on affiche le titre et le code du salon, puis on quitte.
    win.webContents.on('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 6000));
      const info = await win.webContents.executeJavaScript(
        "document.title + ' | ' + location.href + ' | code=' + (sessionStorage.getItem('canapet.tvcode') || '?')",
      );
      console.log('SMOKE ' + info);
      app.quit();
    });
  }
  open();
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
