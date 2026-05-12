import { useState, useEffect } from 'react';
import Scanner from '../components/Scanner';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, BookOpen } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getApiUrl } from '../api';

export default function Return() {
  const [searchParams] = useSearchParams();
  // Pre-selected book from book list (for books without barcodes)
  const preBookId = searchParams.get('book_id') ? parseInt(searchParams.get('book_id')) : null;
  const preBookTitle = searchParams.get('book_title') || '';
  const preIsbn = searchParams.get('isbn') || '';

  const [step, setStep] = useState(preBookId ? 'confirm' : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [scannedIsbn, setScannedIsbn] = useState('');
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedBookTitle, setSelectedBookTitle] = useState('');

  useEffect(() => {
    if (preBookId) {
      setSelectedBookId(preBookId);
      setSelectedBookTitle(preBookTitle);
      setScannedIsbn(preIsbn);
    }
  }, []);

  const handleScan = async (decodedText) => {
    setScannedIsbn(decodedText);
    setSelectedBookId(null);
    submitReturn({ isbn: decodedText });
  };

  const submitReturn = async ({ isbn, bookId, userId } = {}) => {
    setLoading(true);
    setError('');

    try {
      let url = '/api/lending/return?';
      if (bookId) {
        url += `book_id=${bookId}`;
      } else if (isbn) {
        url += `isbn=${isbn}`;
      }
      if (userId) url += `&user_id=${userId}`;

      const res = await fetch(getApiUrl(url), { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.detail?.candidates) {
          setCandidates(data.detail.candidates);
          setStep(1.5);
          return;
        }
        throw new Error(data.detail || '返却処理に失敗しました');
      }

      setStep(2);
    } catch (err) {
      setError(err.message);
      setStep(preBookId ? 'confirm' : 1);
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Handler for pre-selected book confirmation button
  const handleConfirmReturn = () => {
    submitReturn({ bookId: selectedBookId, isbn: scannedIsbn });
  };

  return (
    <div className="max-w-md mx-auto space-y-8 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-300">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gradient">本を返す</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle size={20} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Step 'confirm': book pre-selected from list — just confirm return */}
      {step === 'confirm' && (
        <div className="space-y-6 glass-panel p-6 rounded-2xl animate-in slide-in-from-right-4">
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
            <BookOpen size={20} className="text-primary shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">返却する本</p>
              <p className="font-bold text-white">{selectedBookTitle}</p>
            </div>
          </div>

          <p className="text-gray-400 text-sm text-center">この本を返却しますか？</p>

          <button
            onClick={handleConfirmReturn}
            disabled={loading}
            className="w-full py-4 bg-primary text-gray-900 font-extrabold text-lg rounded-xl hover:bg-primary-hover hover:shadow-[0_0_20px_rgba(108,210,209,0.4)] transition-all flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : '返却する'}
          </button>
        </div>
      )}

      {/* Step 1: scan or manual */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl relative">
            <p className="text-gray-400 text-center text-sm font-medium mb-4">返却する本のバーコードをスキャンしてください</p>
            {!loading ? (
              <Scanner onScan={handleScan} />
            ) : (
              <div className="h-64 flex items-center justify-center bg-black/20 rounded-xl border border-white/5">
                <Loader2 className="animate-spin text-primary" size={40} />
              </div>
            )}
          </div>

          <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
            <p className="text-gray-400 text-sm font-medium mb-4">またはISBNを手動で入力</p>
            <div className="flex w-full gap-2">
              <input
                type="text"
                value={scannedIsbn}
                onChange={(e) => setScannedIsbn(e.target.value)}
                placeholder="ISBNを入力 (例: 978...)"
                className="flex-1 p-3 glass-input rounded-xl text-sm font-mono"
              />
              <button
                onClick={() => { if (scannedIsbn) submitReturn({ isbn: scannedIsbn }); }}
                disabled={loading}
                className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 disabled:opacity-50 transition-colors"
              >
                返却
              </button>
            </div>
          </div>

          <Link
            to="/"
            className="flex items-center justify-center gap-2 py-3 text-sm text-primary hover:text-primary-hover transition-colors font-medium"
          >
            <BookOpen size={16} />
            蔵書一覧から選ぶ
          </Link>
        </div>
      )}

      {/* Step 1.5: multiple borrowers for same book */}
      {step === 1.5 && (
        <div className="space-y-6 glass-panel p-6 rounded-2xl animate-in slide-in-from-right-4">
          <p className="text-white text-center text-sm font-bold">同じ本が複数人に貸出中です。<br />どなたの返却ですか？</p>
          <div className="space-y-3 mt-4">
            {candidates.map((c) => (
              <button
                key={c.user_id}
                onClick={() => submitReturn({ isbn: scannedIsbn, bookId: selectedBookId, userId: c.user_id })}
                className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-primary/20 hover:border-primary/50 transition-all font-bold flex flex-col items-center gap-1"
              >
                <span>{c.name}</span>
                <span className="text-xs text-gray-400 font-mono">{c.user_id}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setStep(preBookId ? 'confirm' : 1); setCandidates([]); }}
            className="w-full py-3 mt-4 text-gray-400 text-sm font-medium hover:text-white transition-colors"
          >
            キャンセル
          </button>
        </div>
      )}

      {/* Step 2: success */}
      {step === 2 && (
        <div className="text-center space-y-6 py-10 glass-panel p-6 rounded-2xl animate-in zoom-in-95">
          <div className="inline-flex justify-center items-center w-24 h-24 bg-primary/20 border border-primary/30 rounded-full text-primary mb-2 shadow-[0_0_30px_rgba(108,210,209,0.2)]">
            <CheckCircle2 size={48} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white mb-2">返却完了</h2>
            <p className="text-gray-400 leading-relaxed">本を元の場所に戻してください。<br />ご協力ありがとうございます！</p>
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
