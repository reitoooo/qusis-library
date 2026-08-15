import { useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiUrl } from '../api';

export default function MyPage() {
  const [studentId, setStudentId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [logs, setLogs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');

  const fetchLogs = async (e) => {
    e.preventDefault();
    if (!studentId || !pinCode) return setError("学籍番号とPINコードを入力してください");
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [resLogs, resReservations] = await Promise.all([
        fetch(getApiUrl(`/api/users/${studentId.toUpperCase()}/lending-logs?pin_code=${pinCode}`)),
        fetch(getApiUrl(`/api/reservations/me?user_id=${studentId.toUpperCase()}&pin_code=${pinCode}`))
      ]);
      
      if (resLogs.ok && resReservations.ok) {
        const dataLogs = await resLogs.json();
        const dataRes = await resReservations.json();
        setLogs(Array.isArray(dataLogs) ? dataLogs : []);
        setReservations(Array.isArray(dataRes) ? dataRes : []);
        setSearched(true);
      } else {
        const data = await resLogs.json();
        throw new Error(data.detail || "エラーが発生しました");
      }
    } catch(err) {
      setError(err.message);
      setSearched(false);
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async (logId) => {
    if (!window.confirm("貸出期間の延長を申請しますか？")) return;
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(getApiUrl(`/api/lending/${logId}/extend`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin_code: pinCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "申請に失敗しました");
      
      setSuccess("延長申請を送信しました");
      // 更新後のデータでlogsを上書き
      setLogs(logs.map(log => log.id === logId ? data : log));
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    if (newPin.length !== 4) return setError("新しいPINは4桁の数字にしてください");
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(getApiUrl(`/api/users/${studentId.toUpperCase()}/change-pin`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_pin: pinCode, new_pin: newPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "PIN変更に失敗しました");
      
      setSuccess("PINコードを変更しました");
      setPinCode(newPin);
      setNewPin('');
      setShowPinChange(false);
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    if (!window.confirm("この予約をキャンセルしますか？")) return;
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(getApiUrl(`/api/reservations/${reservationId}/cancel`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'user-id': studentId.toUpperCase()
        },
        body: JSON.stringify({ pin_code: pinCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "キャンセルに失敗しました");
      
      setSuccess("予約をキャンセルしました");
      setReservations(reservations.filter(r => r.id !== reservationId));
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-300 md:hidden">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gradient">マイページ</h1>
          <p className="text-gray-400 font-medium mt-1">現在の貸出状況と過去のインプット履歴</p>
        </div>
      </div>
      
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm mb-4">{error}</div>}
      {success && <div className="p-4 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm mb-4">{success}</div>}

      <form onSubmit={fetchLogs} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <input 
          required
          type="text" 
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="学籍番号 (例: 1XX23456X)" 
          className="flex-1 w-full p-3 sm:p-4 glass-input rounded-xl focus:ring-2 focus:ring-primary focus:outline-none text-base sm:text-lg tracking-wider"
        />
        <input 
          required
          type="password" 
          inputMode="numeric"
          maxLength={4}
          value={pinCode}
          onChange={(e) => setPinCode(e.target.value)}
          placeholder="PIN (初期: 0000)" 
          className="w-full sm:w-40 p-3 sm:p-4 glass-input rounded-xl focus:ring-2 focus:ring-primary focus:outline-none text-base sm:text-lg tracking-widest text-center"
        />
        <button type="submit" disabled={loading} className="w-full sm:w-auto px-4 sm:px-8 py-3 sm:py-4 bg-primary text-gray-900 font-extrabold rounded-xl hover:bg-primary-hover flex items-center justify-center shrink-0 transition-all hover:shadow-[0_0_15px_rgba(108,210,209,0.3)] disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={24}/> : '表示'}
        </button>
      </form>

      {searched && !showPinChange && (
        <div className="flex justify-end">
          <button onClick={() => setShowPinChange(true)} className="text-sm text-gray-400 hover:text-white transition-colors underline underline-offset-4">PINコードを変更する</button>
        </div>
      )}

      {showPinChange && (
        <form onSubmit={handleChangePin} className="glass-panel p-6 rounded-2xl animate-in slide-in-from-top-2">
          <h3 className="font-bold text-white mb-4">新しいPINコードの設定</h3>
          <div className="flex gap-3">
            <input 
              required
              type="password" 
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="新しい4桁の数字" 
              className="flex-1 p-3 glass-input rounded-xl tracking-widest text-center"
            />
            <button type="submit" disabled={loading} className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/10 disabled:opacity-50">
              変更
            </button>
          </div>
          <button type="button" onClick={() => setShowPinChange(false)} className="mt-4 text-xs text-gray-400 hover:text-white w-full text-center">キャンセル</button>
        </form>
      )}

      {searched && (
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="font-bold text-xl text-white mb-6">貸出・返却履歴</h2>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8 font-medium">履歴が見つかりませんでした</p>
          ) : (
            <div className="space-y-4">
              {logs.map(log => (
                <div key={log.id} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div>
                      {log.book ? (
                        <p className="font-bold text-white mb-1">『{log.book.title}』 <span className="font-mono text-xs text-gray-400 font-normal ml-2">({log.book.isbn})</span></p>
                      ) : (
                        <p className="font-bold text-gray-500 mb-1 italic">(削除済みの本) <span className="font-mono text-xs font-normal ml-2">ID: {log.book_id}</span></p>
                      )}
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                        <p>借入: {new Date(log.borrowed_at).toLocaleDateString()}</p>
                        <p>期限: {new Date(log.due_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      {log.returned_at ? (
                        <span className="inline-flex items-center px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-bold">
                          返却済 ({new Date(log.returned_at).toLocaleDateString()})
                        </span>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          <span className="inline-flex items-center px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-xs font-bold">
                            貸出中
                          </span>
                          {log.is_extension_requested ? (
                            <span className="text-xs px-3 py-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg font-medium">
                              延長申請中
                            </span>
                          ) : (
                            <button 
                              onClick={() => handleExtend(log.id)}
                              disabled={loading}
                              className="text-xs px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-50"
                            >
                              延長する
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {searched && (
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="font-bold text-xl text-white mb-6">予約状況</h2>
          {reservations.length === 0 ? (
            <p className="text-gray-500 text-center py-8 font-medium">現在予約中の本はありません</p>
          ) : (
            <div className="space-y-4">
              {reservations.map(res => (
                <div key={res.id} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div>
                      {res.book ? (
                        <p className="font-bold text-white mb-1">『{res.book.title}』 <span className="font-mono text-xs text-gray-400 font-normal ml-2">({res.book.isbn})</span></p>
                      ) : (
                        <p className="font-bold text-gray-500 mb-1 italic">(削除済みの本) <span className="font-mono text-xs font-normal ml-2">ID: {res.book_id}</span></p>
                      )}
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                        <p>予約日: {new Date(res.reserved_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="inline-flex items-center px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-xs font-bold">
                          予約中
                        </span>
                        <button 
                          onClick={() => handleCancelReservation(res.id)}
                          disabled={loading}
                          className="text-xs px-3 py-1.5 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-50"
                        >
                          キャンセルする
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
