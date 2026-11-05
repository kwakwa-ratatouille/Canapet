// Fabrique les images de la fiche Google Play dans store/images (site lancé en local : npm run dev).
// Usage, depuis desktop/ : npx electron ../store/make-images.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5180/Canapet/';
const OUT = path.join(__dirname, 'images');
const PUB = path.join(__dirname, '..', 'public', 'da');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.commandLine.appendSwitch('force-device-scale-factor', '2');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

async function open(w, h, hash, zoom = 1) {
  const win = new BrowserWindow({ width: w, height: h, show: false, frame: false, useContentSize: true, enableLargerThanScreen: true, webPreferences: { backgroundThrottling: false } });
  win.setContentSize(w, h);
  win.webContents.setAudioMuted(true);
  await win.loadURL(BASE + hash).catch(() => wait(1500));
  win.webContents.setZoomFactor(zoom);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => 1)');
  return win;
}
async function shot(win, name) {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG());
  const s = img.getSize();
  console.log(name, s.width + 'x' + s.height);
}
const js = (win, code) => win.webContents.executeJavaScript(code);
const press = (win, key) => js(win, `window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},bubbles:true})),1`);
/** Attend que le jeu ait vraiment commencé (tuto et compte à rebours finis). */
async function untilPlaying(win, extra) {
  // Fenêtre cachée : le navigateur ralentit l'animation, on fait donc avancer le jeu nous-mêmes
  const run = (secs) => js(win, `(()=>{window.__t=Math.max(window.__t||0,performance.now());for(let i=0;i<${Math.round(secs * 60)};i++){window.__t+=16.67;__session.frame(window.__t);}return 1})()`);
  let on = false;
  for (let i = 0; i < 40 && !on; i++) {
    await run(1);
    on = await js(win, '!!(__session.phase === "game" && __session.clock >= __session.intro + 3.5)');
    await wait(30);
  }
  await run(extra / 1000);
  await wait(400);
  return on;
}

const svg = (p) => fs.readFileSync(path.join(PUB, p), 'utf8');
const PERSOS = ['tartine', 'cornichon', 'pizza', 'nuage', 'banane', 'tomate'];
const FEATURE_HTML = `<div id="f"><div class="l">${svg('logo/logotype.svg')}</div><h1>Ton salon devient une soirée de jeux</h1><p>La télé affiche le jeu, chaque téléphone devient une manette</p><div id="c">${PERSOS.map((p) => `<div class="p">${svg(`persos/${p}.svg`)}</div>`).join('')}</div></div>`;
const FEATURE = `(async()=>{
  document.body.innerHTML=${JSON.stringify(FEATURE_HTML)};
  const st=document.createElement('style');
  st.textContent='html,body{margin:0;overflow:hidden}svg{display:block;width:100%;height:100%}#f{position:fixed;inset:0;background:linear-gradient(160deg,#ffe3ef,#fff4c9 55%,#d6f7ea);text-align:center;color:#3a2140;font-family:Fredoka,sans-serif}.l{height:112px;width:360px;margin:14px auto 0}h1{font-size:44px;font-weight:700;margin:0 0 2px}p{font-family:Nunito,sans-serif;font-weight:800;font-size:22px;margin:0}#c{position:absolute;left:0;right:0;bottom:6px;display:flex;justify-content:center;gap:18px}.p{height:200px;width:147px}';
  document.head.append(st);
  await document.fonts.load('700 44px Fredoka');
  await document.fonts.load('800 22px Nunito');
  return 1})()`;

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  // Image de présentation : 1024 × 500
  let win = await open(1024, 500, '#/aide');
  await js(win, FEATURE);
  await wait(800);
  const big = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'presentation-1024x500.png'), big.resize({ width: 1024, height: 500, quality: 'best' }).toPNG());
  win.destroy();

  // Manette : 1080 × 1920 (salon) et 1920 × 1080 (en jeu, téléphone à l'horizontale)
  win = await open(540, 960, '#/m/TEST?s=lobby');
  await wait(2000);
  await js(win, `[...document.querySelectorAll('.pad *')].filter(e=>!e.children.length&&/^0 jeux/.test(e.textContent)).forEach(e=>e.textContent='28 jeux au catalogue'),1`);
  await wait(200);
  await shot(win, 'manette-salon');
  win.destroy();
  win = await open(960, 540, '#/m/TEST?s=stick');
  await wait(2000);
  await shot(win, 'manette-jeu');
  win.destroy();

  // Télé : 1920 × 1080, le vrai affichage d'un écran Full HD
  win = await open(960, 540, '#/tv?apercu=1', 0.5);
  await wait(3000);
  await js(win, "Promise.all(['700 40px Fredoka','600 40px Fredoka','800 30px Nunito','700 30px Nunito'].map((f)=>document.fonts.load(f))).then(()=>1)");
  for (const [name, key, extra] of [['tele-sumo', 's', 5000], ['tele-bolides', 'k', 9000], ['tele-tribunal', '0', 2500], ['tele-petards', 'p', 12000]]) {
    await press(win, 'l');
    await wait(1200);
    await press(win, key);
    console.log(name, 'en jeu :', await untilPlaying(win, extra));
    await shot(win, name);
  }
  win.destroy();
  app.quit();
});
