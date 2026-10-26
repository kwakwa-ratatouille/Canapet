import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QR({ text, size }: { text: string; size: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: size * 2, color: { dark: '#3a2140', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [text, size]);
  return src ? <img src={src} width={size} height={size} alt="QR code" className="qr" /> : null;
}
