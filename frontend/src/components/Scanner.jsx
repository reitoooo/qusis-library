import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export default function Scanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    // ISBN (EAN-13) だけをスキャン対象に制限して処理速度を爆速にする
    const html5QrCode = new Html5Qrcode("reader", {
      formatsToSupport: [ Html5QrcodeSupportedFormats.EAN_13 ]
    });
    scannerRef.current = html5QrCode;

    const startCamera = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 30, // フレームレートを上げてスキャン頻度を増やす
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              return {
                width: Math.min(viewfinderWidth * 0.9, 300),
                height: 100 
              };
            }
          },
          (decodedText) => {
            if (decodedText.startsWith("978")) {
              if (isScanningRef.current) return;
              isScanningRef.current = true;
              
              // 読み取り直後に即座にAPIを叩く。カメラ停止はReactのアンマウント処理(cleanup)に任せる
              onScan(decodedText);
            }
          },
          (errorMessage) => {
            // 無視できるスキャン中のエラーはonErrorに渡さない
          }
        );
      } catch (err) {
        console.error("Camera start failed:", err);
        if (onError) onError("カメラの起動に失敗しました。カメラのアクセス権限を確認してください。");
      }
    };

    startCamera();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan, onError]);

  return (
    <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-xl shadow-md border border-white/10 bg-black aspect-video flex items-center justify-center">
      <div id="reader" className="w-full h-full"></div>
      {/* 起動中のローディング表示などが必要であればここに追加 */}
    </div>
  );
}
