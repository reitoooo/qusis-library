import { useState } from 'react';
import Scanner from '../components/Scanner';
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiUrl } from '../api';

export default function Lend() {
  const [isbn, setIsbn] = useState('');
  const [studentId, setStudentId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = (decodedText) => {
    setIsbn(decodedText);
    setStep(2);
    setError('');
  };

  const handleLend = async () => {
    if (!studentId) return setError("学籍番号を入力してください");
    if (!pinCode || pinCode.length !== 4) return setError("4桁のPINコードを入力してください（初期設定は0000）");
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(getApiUrl('/api/lending/lend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_isbn: isbn, user_id: studentId.toUpperCase(), pin_code: pinCode })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "貸出処理に失敗しました");
      }
      
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-8 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-300">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gradient">本を借りる</h1>
      </div>

      {step === 1 && (
        <div className="space-y-6 glass-panel p-6 rounded-2xl">
          <p className="text-gray-400 text-center text-sm font-medium">裏面の上段バーコード（978~）をスキャン</p>
          <Scanner onScan={handleScan} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 glass-panel p-6 rounded-2xl animate-in slide-in-from-right-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}
        
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ISBN</label>
            <input type="text" readOnly value={isbn} className="w-full p-3 glass-input rounded-xl text-gray-300 font-mono" />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">学籍番号</label>
            <input 
              type="text" 
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="例: 1XX23456X" 
              className="w-full p-4 glass-input rounded-xl text-lg font-bold tracking-widest text-center" 
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">PINコード</label>
            <input 
              type="password" 
              inputMode="numeric"
              maxLength={4}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              placeholder="0000" 
              className="w-full p-4 glass-input rounded-xl text-lg font-bold tracking-widest text-center" 
            />
          </div>

          <button 
            onClick={handleLend}
            disabled={loading}
            className="w-full py-4 bg-primary text-gray-900 font-extrabold text-lg rounded-xl hover:bg-primary-hover hover:shadow-[0_0_20px_rgba(108,210,209,0.4)] transition-all flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : '貸出を実行する'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-6 py-10 glass-panel p-6 rounded-2xl animate-in zoom-in-95">
          <div className="inline-flex justify-center items-center w-24 h-24 bg-primary/20 border border-primary/30 rounded-full text-primary mb-2 shadow-[0_0_30px_rgba(108,210,209,0.2)]">
            <CheckCircle2 size={48} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white mb-2">貸出完了</h2>
            <p className="text-gray-400 leading-relaxed">返却期限は2週間後です。<br/>最高のインプットを！</p>
          </div>
          <div className="pt-6">
            <Link to="/" className="inline-block px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-colors">
              トップへ戻る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
