// Ajoute les autorisations (galerie, caméra pour le selfie) au manifeste Android généré.
const fs = require('fs');
const f = 'android/app/src/main/AndroidManifest.xml';
let s = fs.readFileSync(f, 'utf8');
const perms = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.CAMERA',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
]
  .map((p) => `    <uses-permission android:name="${p}" />`)
  .join('\n');
const legacy = '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />';
s = s.replace('</manifest>', () => `${perms}\n${legacy}\n</manifest>`);
fs.writeFileSync(f, s);
console.log('manifeste ok');
