import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function Scanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    // コンポーネントのマウント時に一度だけ初期化
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const startCamera = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // 背面カメラを強制
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              return {
                width: Math.min(viewfinderWidth * 0.9, 300),
                height: 80 // バーコード用
              };
            }
          },
          (decodedText) => {
            if (decodedText.startsWith("978")) {
              if (isScanningRef.current) return;
              isScanningRef.current = true;
              
              // スキャン成功時に自動で止める
              html5QrCode.stop().then(() => {
                onScan(decodedText);
              }).catch(console.error);
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
