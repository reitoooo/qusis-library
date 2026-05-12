import { useState, useEffect } from 'react';
import Scanner from '../components/Scanner';
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getApiUrl } from '../api';

export default function Lend() {
  const [searchParams] = useSearchParams();
  // Pre-selected book from book list (for books without barcodes)
  const preBookId = searchParams.get('book_id') ? parseInt(searchParams.get('book_id')) : null;
  const preBookTitle = searchParams.get('book_title') || '';
  const preIsbn = searchParams.get('isbn') || '';

  const [isbn, setIsbn] = useState('');
  const [bookId, setBookId] = useState(null);        // when selected from list
  const [bookTitle, setBookTitle] = useState('');     // display name when pre-selected
  const [studentId, setStudentId] = useState('');
  const [pinCode, setPinCode] = useState('');
  // If a book was pre-selected from the list, jump straight to step 2
  const [step, setStep] = useState(preBookId ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (preBookId) {
      setBookId(preBookId);
      setBookTitle(preBookTitle);
      setIsbn(preIsbn);
    }
  }, []);

  const handleScan = (decodedText) => {
    setIsbn(decodedText);
    setBookId(null);
    setBookTitle('');
    setStep(2);
    setError('');
  };

  const handleLend = async () => {
    if (!studentId) return setError('学籍番号を入力してください');
    if (!pinCode || pinCode.length !== 4) return setError('4桁のPINコードを入力してください（初期設定は0000）');

    setLoading(true);
    setError('');

    try {
      const body = {
        user_id: studentId.toUpperCase(),
        pin_code: pinCode,
      };
      // Prefer book_id (works for no-barcode books), fallback to isbn
      if (bookId) {
        body.book_id = bookId;
      } else {
        body.book_isbn = isbn;
      }

      const res = await fetch(getApiUrl('/api/lending/lend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || '貸出処理に失敗しました');
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

      {/* Step 1: Scan or select */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl">
            <p className="text-gray-400 text-center text-sm font-medium mb-4">裏面の上段バーコード（978~）をスキャン</p>
            <Scanner onScan={handleScan} />
          </div>

          <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
            <p className="text-gray-400 text-sm font-medium mb-4">またはISBNを手動で入力</p>
            <div className="flex w-full gap-2">
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="ISBNを入力 (例: 978...)"
                className="flex-1 p-3 glass-input rounded-xl text-sm font-mono"
              />
              <button
                onClick={() => { if (isbn) { setStep(2); setError(''); } }}
                className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
              >
                次へ
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

      {/* Step 2: Enter credentials */}
      {step === 2 && (
        <div className="space-y-6 glass-panel p-6 rounded-2xl animate-in slide-in-from-right-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Show selected book */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              {bookId ? '選択した本' : 'ISBN'}
            </label>
            {bookId ? (
              <div className="w-full p-3 glass-input rounded-xl text-gray-200 font-medium flex items-center gap-2">
                <BookOpen size={16} className="text-primary shrink-0" />
                {bookTitle}
              </div>
            ) : (
              <input type="text" readOnly value={isbn} className="w-full p-3 glass-input rounded-xl text-gray-300 font-mono" />
            )}
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

          {!bookId && (
            <button onClick={() => setStep(1)} className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors">
              ← スキャンし直す
            </button>
          )}
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className="text-center space-y-6 py-10 glass-panel p-6 rounded-2xl animate-in zoom-in-95">
          <div className="inline-flex justify-center items-center w-24 h-24 bg-primary/20 border border-primary/30 rounded-full text-primary mb-2 shadow-[0_0_30px_rgba(108,210,209,0.2)]">
            <CheckCircle2 size={48} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white mb-2">貸出完了</h2>
            <p className="text-gray-400 leading-relaxed">返却期限は2週間後です。<br />最高のインプットを！</p>
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
