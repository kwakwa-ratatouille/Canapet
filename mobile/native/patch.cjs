// Prépare le projet Android généré : autorisations, et pour Google Play (PLAY=1) signature et numéro de version.
const fs = require('fs');
const PLAY = process.env.PLAY === '1';
const f = 'android/app/src/main/AndroidManifest.xml';
let s = fs.readFileSync(f, 'utf8');
// Google Play réserve l'accès à toute la galerie aux applis de galerie : la version Play passe par le sélecteur du système.
const perms = (PLAY
  ? ['android.permission.CAMERA', 'android.permission.VIBRATE']
  : ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.CAMERA', 'android.permission.VIBRATE', 'android.permission.WAKE_LOCK']
)
  .map((p) => `    <uses-permission android:name="${p}" />`)
  .join('\n');
const legacy = PLAY ? '' : '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />';
s = s.replace('</manifest>', () => `${perms}\n${legacy}\n</manifest>`);
fs.writeFileSync(f, s);

if (PLAY) {
  const main = 'android/app/src/main/java/com/canapet/app/MainActivity.java';
  fs.writeFileSync(main, fs.readFileSync(main, 'utf8').replace(/ *registerPlugin\(GalleryPlugin\.class\);\r?\n?/, ''));
  // Reconnu par le site : pas de galerie, et plus tard l'achat par Google Play
  const conf = 'android/app/src/main/assets/capacitor.config.json';
  const c = JSON.parse(fs.readFileSync(conf, 'utf8'));
  c.android = { ...c.android, appendUserAgent: 'CanapetPlay' };
  fs.writeFileSync(conf, JSON.stringify(c, null, 2));
  const g = 'android/app/build.gradle';
  let b = fs.readFileSync(g, 'utf8');
  const n = process.env.BUILD_NUMBER || '1';
  b = b.replace(/versionCode \d+/, `versionCode ${100 + Number(n)}`).replace(/versionName "[^"]*"/, `versionName "1.0.${n}"`);
  // Sans clé (secrets pas encore ajoutés), on vérifie seulement que la version Play se fabrique
  if (process.env.SIGN === '1') {
    b = b.replace(/buildTypes \{/, () => `signingConfigs {
        release {
            storeFile file(System.getenv("UPLOAD_KEY_FILE"))
            storeType "pkcs12"
            storePassword System.getenv("UPLOAD_KEY_PASSWORD")
            keyAlias System.getenv("UPLOAD_KEY_ALIAS")
            keyPassword System.getenv("UPLOAD_KEY_PASSWORD")
        }
    }
    buildTypes {`);
    b = b.replace(/(release \{\s*\n\s*)(minifyEnabled)/, (m, a, c2) => `${a}signingConfig signingConfigs.release\n            ${c2}`);
  }
  fs.writeFileSync(g, b);
}
console.log('projet Android prêt', PLAY ? '(Google Play)' : '(installation directe)');
