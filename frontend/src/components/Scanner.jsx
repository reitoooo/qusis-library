import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function Scanner({ onScan, onError }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          return {
            width: Math.min(viewfinderWidth * 0.9, 300),
            height: 80 // 縦幅を狭くして、下のバーコードを拾わないようにする
          };
        }
      },
      false
    );

    scanner.render(
      (decodedText) => {
        // ISBN（978始まり）以外のバーコードは無視してスキャンを継続する
        if (decodedText.startsWith("978")) {
          onScan(decodedText);
        }
      },
      (error) => {
        if (onError) onError(error);
      }
    );

    return () => {
      scanner.clear().catch(e => console.error(e));
    };
  }, [onScan, onError]);

  return <div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-lg shadow-md border bg-white"></div>;
}
