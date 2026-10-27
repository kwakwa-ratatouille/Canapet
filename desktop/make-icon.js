// Fabrique icon.png (512×512) : le coussin péteur de Cana'pet, sans aucune dépendance.
const fs = require('fs');
const zlib = require('zlib');

const S = 512;
const px = Buffer.alloc(S * S * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function put(x, y, c, a = 255) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  const k = a / 255;
  px[i] = Math.round(c[0] * k + px[i] * (1 - k));
  px[i + 1] = Math.round(c[1] * k + px[i + 1] * (1 - k));
  px[i + 2] = Math.round(c[2] * k + px[i + 2] * (1 - k));
  px[i + 3] = Math.max(px[i + 3], a);
}
/** Remplit une forme définie par une fonction distance signée (anticrénelage simple). */
function shape(sdf, color) {
  const c = hex(color);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = sdf(x + 0.5, y + 0.5);
      if (d < 1) put(x, y, c, Math.round(255 * Math.min(1, Math.max(0, 1 - d))));
    }
}
const ellipse = (cx, cy, rx, ry) => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const rrect = (x0, y0, w, h, r) => (x, y) => {
  const qx = Math.abs(x - (x0 + w / 2)) - (w / 2 - r);
  const qy = Math.abs(y - (y0 + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const grow = (f, n) => (x, y) => f(x, y) - n;

// Fond : carré arrondi jaune
shape(rrect(16, 16, 480, 480, 110), '#3a2140');
shape(rrect(28, 28, 456, 456, 100), '#ffd60a');
// Coussin rose avec contour prune
shape(grow(ellipse(256, 280, 190, 160), 12), '#3a2140');
shape(ellipse(256, 280, 190, 160), '#ff7eb3');
shape(rrect(400, 330, 70, 44, 18), '#3a2140');
shape(rrect(408, 338, 54, 28, 12), '#ff5c9e');
shape(ellipse(190, 200, 50, 22), '#ffb3d1');
// Yeux
for (const ex of [200, 312]) {
  shape(grow(ellipse(ex, 262, 34, 42), 8), '#3a2140');
  shape(ellipse(ex, 262, 34, 42), '#ffffff');
  shape(ellipse(ex + 6, 270, 17, 19), '#3a2140');
}
// Sourire
const smile = (x, y) => {
  const d = Math.hypot(x - 256, y - 310) - 52;
  return y < 318 ? 99 : Math.abs(d) - 9;
};
shape(smile, '#3a2140');

// Encodage PNG
const crcT = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc = (b) => {
  let c = -1;
  for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
fs.writeFileSync(
  __dirname + '/icon.png',
  Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]),
);
console.log('icon.png ok');
