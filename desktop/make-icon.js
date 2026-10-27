// Fabrique icon.png (512×512) à partir de l'icône de la DA (public/da/logo/icone-claire.svg),
// rendue par Electron avec la police Fredoka chargée (le texte du logo en dépend).
// Usage : npx electron make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, '..', 'public', 'da', 'logo', 'icone-claire.svg'), 'utf8');
const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@800&display=block" rel="stylesheet">
<style>html,body{margin:0;background:transparent}svg{width:512px;height:512px;display:block}</style></head>
<body>${svg}</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, useContentSize: true });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const ok = await win.webContents.executeJavaScript(
    "document.fonts.load('700 40px Fredoka').then(() => document.fonts.ready).then(() => document.fonts.check('700 40px Fredoka'))",
  );
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.writeFileSync(path.join(__dirname, 'icon.png'), img.resize({ width: 512, height: 512 }).toPNG());
  console.log('icon.png ok, Fredoka chargée : ' + ok);
  app.quit();
});
