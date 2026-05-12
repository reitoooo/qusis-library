import { useState, useEffect } from 'react';
import Scanner from '../components/Scanner';
import { Loader2, AlertCircle, Check, Lock, Edit2, Trash2, X, Upload, ArrowLeft, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiUrl } from '../api';

export default function Admin() {
  const [password, setPassword] = useState(() => localStorage.getItem('adminAuthPassword') || '');
  const [authenticated, setAuthenticated] = useState(() => !!localStorage.getItem('adminAuthPassword'));
  
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [mode, setMode] = useState(''); // 'register_book', 'view_users', 'view_books', 'active_lending'
  const [activeLendings, setActiveLendings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Create user form
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserSlackId, setNewUserSlackId] = useState('');
  const [csvFile, setCsvFile] = useState(null);

  // Manual book form
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');

  // Edit states
  const [editingUser, setEditingUser] = useState(null);
  const [editingBook, setEditingBook] = useState(null);

  useEffect(() => {
    if (mode === 'view_users') fetchUsers();
    if (mode === 'view_books') fetchBooks();
    if (mode === 'active_lending') fetchActiveLendings();
  }, [mode]);

  const adminFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'X-Admin-Password': password
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('adminAuthPassword');
      setAuthenticated(false);
      setPassword('');
      throw new Error("セッションが切れました。再度ログインしてください。");
    }
    return res;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(getApiUrl('/api/users/'));
      const data = await res.json();
      if(Array.isArray(data)) setUsers(data);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(getApiUrl('/api/books/'));
      const data = await res.json();
      if(Array.isArray(data)) setBooks(data);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveLendings = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(getApiUrl('/api/lending/active'));
      const data = await res.json();
      if(Array.isArray(data)) setActiveLendings(data);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  // --- User Operations ---
  const handleRegisterUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminFetch(getApiUrl('/api/users/'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: newUserId.toUpperCase(), name: newUserName, notification_id: newUserSlackId || null })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "登録に失敗しました");
      showMessage("ユーザーを登録しました");
      setNewUserId('');
      setNewUserName('');
      setNewUserSlackId('');
      fetchUsers();
    } catch (e) {
      showMessage(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    setLoading(true);
    
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      const usersToImport = [];
      
      for (const line of lines) {
        if (line.includes("学籍番号") || line.includes("名前") || line.includes("氏名")) continue;
        
        const parts = line.split(',');
        if (parts.length >= 2) {
          usersToImport.push({
            user_id: parts[0].trim().toUpperCase(),
            name: parts[1].trim(),
            notification_id: parts[2] ? parts[2].trim() : null
          });
        }
      }
      
      if (usersToImport.length === 0) {
        throw new Error("インポートするデータが見つかりませんでした。形式が「学籍番号,氏名」になっているか確認してください。");
      }

      const res = await adminFetch(getApiUrl('/api/users/bulk'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(usersToImport)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "一括登録に失敗しました");
      
      showMessage(data.detail);
      setCsvFile(null);
      document.getElementById('csv-upload').value = '';
      fetchUsers();
    } catch(err) {
      showMessage(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await adminFetch(getApiUrl(`/api/users/${editingUser.user_id}`), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name: editingUser.name, pin_code: editingUser.pin_code, is_active: editingUser.is_active, notification_id: editingUser.notification_id || null })
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showMessage("ユーザー情報を更新しました");
      setEditingUser(null);
      fetchUsers();
    } catch(e) {
      showMessage(e.message, true);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(`本当に学籍番号 ${userId} のユーザーを削除しますか？`)) return;
    try {
      const res = await adminFetch(getApiUrl(`/api/users/${userId}`), { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).detail);
      showMessage("ユーザーを削除しました");
      fetchUsers();
    } catch(e) {
      showMessage(e.message, true);
    }
  };

  // --- Book Operations ---
  const handleScanBook = async (isbn) => {
    setLoading(true);
    try {
      const res = await adminFetch(getApiUrl('/api/books/'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ isbn, title: '', author: '' })
      });
      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 404) {
          setManualIsbn(isbn);
          throw new Error("自動取得に失敗しました。右側のフォームから手動で登録してください。");
        }
        throw new Error(errData.detail || "登録に失敗しました");
      }
      const data = await res.json();
      showMessage(`『${data.title}』を登録しました！`);
    } catch(e) {
      showMessage(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRegisterBook = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminFetch(getApiUrl('/api/books/'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ isbn: manualIsbn || 'NO_ISBN', title: manualTitle, author: manualAuthor })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "登録に失敗しました");
      showMessage(`『${manualTitle}』を手動登録しました！`);
      setManualIsbn('');
      setManualTitle('');
      setManualAuthor('');
    } catch(e) {
      showMessage(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBook = async (e) => {
    e.preventDefault();
    try {
      const res = await adminFetch(getApiUrl(`/api/books/${editingBook.id}`), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title: editingBook.title, author: editingBook.author })
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showMessage("書籍情報を更新しました");
      setEditingBook(null);
      fetchBooks();
    } catch(e) {
      showMessage(e.message, true);
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (!window.confirm("本当にこの本を削除しますか？")) return;
    try {
      const res = await adminFetch(getApiUrl(`/api/books/${bookId}`), { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).detail);
      showMessage("本を削除しました");
      fetchBooks();
    } catch(e) {
      showMessage(e.message, true);
    }
  };

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto mt-10 p-8 glass-panel rounded-2xl animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center gap-4 mb-8 text-center">
          <div className="w-20 h-20 bg-primary/10 border border-primary/20 text-primary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(108,210,209,0.15)]">
            <Lock size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-widest">ADMIN LOGIN</h1>
          <p className="text-gray-400 text-sm">システムダッシュボードへアクセス</p>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            const res = await fetch(getApiUrl('/api/users/?limit=1'), {
              headers: { 'X-Admin-Password': password }
            });
            if (res.ok) {
              localStorage.setItem('adminAuthPassword', password);
              setAuthenticated(true);
            } else {
              alert("パスワードが間違っています");
            }
          } catch(err) {
            alert("通信エラーが発生しました");
          }
        }}>
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="PASSWORD" 
            className="w-full p-4 glass-input rounded-xl mb-6 text-center tracking-widest font-mono text-lg" 
          />
          <button type="submit" className="w-full py-4 bg-primary text-gray-900 font-extrabold rounded-xl transition-all hover:bg-primary-hover hover:shadow-[0_0_20px_rgba(108,210,209,0.3)]">LOGIN</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gradient">ダッシュボード</h1>
        <Link to="/" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">トップへ戻る</Link>
      </div>
      
      {!mode ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col h-full">
            <h2 className="font-bold text-xl text-white mb-2">書籍の登録</h2>
            <p className="text-gray-400 text-sm mb-6 flex-1">新しい本をスキャンしてシステムに追加します。OpenBD等から情報を自動取得します。</p>
            <button onClick={() => setMode('register_book')} className="w-full py-3 bg-primary text-gray-900 font-bold rounded-xl hover:bg-primary-hover transition-colors">登録モード起動</button>
          </div>
          <div className="glass-panel p-6 rounded-2xl flex flex-col h-full">
            <h2 className="font-bold text-xl text-white mb-2">書籍の管理</h2>
            <p className="text-gray-400 text-sm mb-6 flex-1">登録されているすべての本を確認し、情報の修正や削除を行います。</p>
            <button onClick={() => setMode('view_books')} className="w-full py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/10">一覧を表示</button>
          </div>
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="font-bold text-xl text-white mb-2">ユーザー管理</h2>
            <p className="text-gray-400 text-sm mb-6">部員名簿の登録や一覧表示、情報の修正や削除を行います。</p>
            <button onClick={() => setMode('view_users')} className="w-full py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/10">一覧を表示</button>
          </div>
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="font-bold text-xl text-white mb-2 flex items-center gap-2"><BookOpen size={20} className="text-primary" />貸出状況</h2>
            <p className="text-gray-400 text-sm mb-6">現在誰がどの本を借りているか、返却期限の状況を確認します。</p>
            <button onClick={() => setMode('active_lending')} className="w-full py-3 bg-primary/20 text-primary font-bold rounded-xl hover:bg-primary/30 transition-colors border border-primary/30">貸出中の本を確認</button>
          </div>
        </div>
      ) : (
        <div className="animate-in slide-in-from-right-4">
          <button onClick={() => setMode('')} className="mb-6 text-primary hover:text-primary-hover transition-colors text-sm font-medium flex items-center gap-2">
            <ArrowLeft size={16}/> ダッシュボードに戻る
          </button>
          
          {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex gap-3"><AlertCircle size={20} className="shrink-0"/>{error}</div>}
          {success && <div className="mb-6 p-4 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm flex gap-3"><Check size={20} className="shrink-0"/>{success}</div>}

          {/* --- Register Book Mode --- */}
          {mode === 'register_book' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="glass-panel p-8 rounded-2xl text-center flex flex-col justify-center">
                 <h2 className="font-bold text-xl text-white mb-6">バーコードで自動登録</h2>
                 {!loading ? <Scanner onScan={handleScanBook} /> : <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={40}/></div>}
               </div>

               <form onSubmit={handleManualRegisterBook} className="glass-panel p-8 rounded-2xl flex flex-col justify-center space-y-4">
                 <h2 className="font-bold text-xl text-white mb-2">手動で登録</h2>
                 <p className="text-sm text-gray-400 mb-4">バーコードがない本や、自動取得に失敗した本はこちらから手入力で登録できます。</p>
                 <div className="space-y-4">
                   <input value={manualTitle} required onChange={e=>setManualTitle(e.target.value)} placeholder="タイトル (必須)" className="w-full p-3 glass-input rounded-xl" />
                   <input value={manualAuthor} onChange={e=>setManualAuthor(e.target.value)} placeholder="著者 (任意)" className="w-full p-3 glass-input rounded-xl" />
                   <input value={manualIsbn} onChange={e=>setManualIsbn(e.target.value)} placeholder="ISBN (任意)" className="w-full p-3 glass-input rounded-xl font-mono text-sm" />
                 </div>
                 <button disabled={loading} type="submit" className="w-full py-3 mt-4 bg-primary text-gray-900 font-bold rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-colors">
                   {loading ? '処理中...' : '手動登録する'}
                 </button>
               </form>
             </div>
          )}

          {/* --- View Books Mode --- */}
          {mode === 'view_books' && (
             <div className="space-y-6">
               <div className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
                 <table className="w-full text-left text-sm min-w-[600px]">
                   <thead className="bg-white/5 border-b border-white/10 text-gray-300">
                     <tr>
                       <th className="p-4 w-16">ID</th>
                       <th className="p-4">タイトル</th>
                       <th className="p-4">著者</th>
                       <th className="p-4">状態</th>
                       <th className="p-4 w-24 text-center">操作</th>
                     </tr>
                   </thead>
                   <tbody className="text-gray-300">
                     {loading ? (
                       <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary"/></td></tr>
                     ) : books.length > 0 ? books.map(b => (
                       <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                         <td className="p-4 text-gray-500 font-mono">{b.id}</td>
                         <td className="p-4 font-bold text-white">{b.title}</td>
                         <td className="p-4 text-gray-400">{b.author}</td>
                         <td className="p-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${b.status === '貸出可能' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>{b.status}</span>
                         </td>
                         <td className="p-4 flex justify-center gap-3">
                           <button onClick={() => setEditingBook(b)} className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteBook(b.id)} className="p-1.5 text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={16}/></button>
                         </td>
                       </tr>
                     )) : (
                       <tr><td colSpan="5" className="p-8 text-center text-gray-500">本が登録されていません</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          )}

          {/* --- View Users Mode --- */}
          {mode === 'view_users' && (
             <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <form onSubmit={handleRegisterUser} className="glass-panel p-6 rounded-2xl space-y-4">
                    <h2 className="font-bold text-white text-lg">手動で1名ずつ登録</h2>
                    <div className="grid grid-cols-1 gap-4">
                      <input required value={newUserId} onChange={e=>setNewUserId(e.target.value)} placeholder="学籍番号 (例: 1XX23456X)" className="w-full p-3 glass-input rounded-xl" />
                      <input required value={newUserName} onChange={e=>setNewUserName(e.target.value)} placeholder="氏名" className="w-full p-3 glass-input rounded-xl" />
                      <input value={newUserSlackId} onChange={e=>setNewUserSlackId(e.target.value)} placeholder="Slack ID (任意: U01XXXXXX)" className="w-full p-3 glass-input rounded-xl font-mono text-sm" />
                    </div>
                    <button disabled={loading} type="submit" className="w-full py-3 bg-primary text-gray-900 rounded-xl hover:bg-primary-hover font-bold disabled:opacity-50 transition-colors">
                      {loading ? '処理中...' : '登録'}
                    </button>
                 </form>

                 <form onSubmit={handleCsvUpload} className="glass-panel p-6 rounded-2xl space-y-4">
                    <h2 className="font-bold text-white text-lg">CSVファイルで一括登録</h2>
                    <p className="text-sm text-gray-400">「学籍番号,氏名,SlackID」の順で並んだCSVファイルを選択してください。（SlackIDは任意です）</p>
                    
                    <div className="relative">
                      <input 
                        id="csv-upload"
                        type="file" 
                        accept=".csv,.txt"
                        onChange={e => setCsvFile(e.target.files[0])}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="p-4 border-2 border-dashed border-white/20 rounded-xl text-center bg-black/20 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors">
                        <Upload size={24} className={csvFile ? 'text-primary' : 'text-gray-500'} />
                        <span className="text-sm font-bold text-white">{csvFile ? csvFile.name : "ファイルを選択"}</span>
                      </div>
                    </div>

                    <button disabled={loading || !csvFile} type="submit" className="w-full py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 font-bold disabled:opacity-50 border border-white/10 transition-colors">
                      {loading ? '処理中...' : '一括インポートを実行'}
                    </button>
                 </form>
               </div>
               
               <div className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
                 <table className="w-full text-left text-sm min-w-[500px]">
                   <thead className="bg-white/5 border-b border-white/10 text-gray-300">
                     <tr>
                       <th className="p-4">学籍番号</th>
                       <th className="p-4">氏名</th>
                       <th className="p-4">Slack ID</th>
                       <th className="p-4">状態</th>
                       <th className="p-4 w-24 text-center">操作</th>
                     </tr>
                   </thead>
                   <tbody className="text-gray-300">
                     {loading ? (
                       <tr><td colSpan="4" className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary"/></td></tr>
                     ) : users.length > 0 ? users.map(u => (
                       <tr key={u.user_id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                         <td className="p-4 font-mono">{u.user_id}</td>
                         <td className="p-4 font-bold text-white">{u.name}</td>
                         <td className="p-4 text-gray-400 font-mono text-xs">{u.notification_id || '-'}</td>
                         <td className="p-4">
                           <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${u.is_active ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                             {u.is_active ? '有効' : '停止'}
                           </span>
                         </td>
                         <td className="p-4 flex justify-center gap-3">
                           <button onClick={() => setEditingUser(u)} className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteUser(u.user_id)} className="p-1.5 text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={16}/></button>
                         </td>
                       </tr>
                     )) : (
                       <tr><td colSpan="4" className="p-8 text-center text-gray-500">ユーザーがいません</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          )}
          {/* --- Active Lending Mode --- */}
          {mode === 'active_lending' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-xl text-white">現在の貸出状況</h2>
                <button onClick={fetchActiveLendings} className="text-sm text-primary hover:text-primary-hover transition-colors font-medium">更新</button>
              </div>
              {loading ? (
                <div className="glass-panel rounded-2xl p-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={40}/></div>
              ) : activeLendings.length === 0 ? (
                <div className="glass-panel rounded-2xl p-12 text-center text-gray-500">現在貸出中の本はありません</div>
              ) : (
                <div className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[650px]">
                    <thead className="bg-white/5 border-b border-white/10 text-gray-300">
                      <tr>
                        <th className="p-4">借りている人</th>
                        <th className="p-4">学籍番号</th>
                        <th className="p-4">書籍タイトル</th>
                        <th className="p-4">借りた日</th>
                        <th className="p-4">返却期限</th>
                        <th className="p-4 text-center">状態</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {activeLendings.map(log => (
                        <tr key={log.id} className={`border-b border-white/5 last:border-0 transition-colors ${log.is_overdue ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'}`}>
                          <td className="p-4 font-bold text-white">{log.user_name}</td>
                          <td className="p-4 font-mono text-gray-400 text-xs">{log.user_id}</td>
                          <td className="p-4">
                            <div className="font-bold text-white">{log.book_title}</div>
                            {log.book_author && <div className="text-xs text-gray-500 mt-0.5">{log.book_author}</div>}
                          </td>
                          <td className="p-4 text-gray-400 text-xs whitespace-nowrap">{new Date(log.borrowed_at).toLocaleDateString('ja-JP')}</td>
                          <td className={`p-4 text-xs whitespace-nowrap font-bold ${log.is_overdue ? 'text-red-400' : 'text-gray-300'}`}>
                            {new Date(log.due_date).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="p-4 text-center">
                            {log.is_overdue
                              ? <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">延滞中</span>
                              : <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30">貸出中</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- Edit Modals --- */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="glass-panel bg-gray-900 rounded-2xl p-8 w-full max-w-sm space-y-6 relative border border-white/10 shadow-2xl">
            <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={24}/></button>
            <h3 className="font-bold text-xl text-white">ユーザー編集</h3>
            <form onSubmit={handleUpdateUser} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">学籍番号</label>
                <input value={editingUser.user_id} disabled className="w-full p-3 bg-black/50 border border-white/5 rounded-xl text-gray-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">氏名</label>
                <input required value={editingUser.name} onChange={e=>setEditingUser({...editingUser, name: e.target.value})} className="w-full p-3 glass-input rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Slack ID</label>
                <input value={editingUser.notification_id || ''} onChange={e=>setEditingUser({...editingUser, notification_id: e.target.value})} placeholder="任意 (例: U01XXXXXX)" className="w-full p-3 glass-input rounded-xl font-mono text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">PINコード</label>
                <input value={editingUser.pin_code || '0000'} onChange={e=>setEditingUser({...editingUser, pin_code: e.target.value})} maxLength={4} className="w-full p-3 glass-input rounded-xl font-mono text-sm" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <input type="checkbox" id="active" checked={editingUser.is_active} onChange={e=>setEditingUser({...editingUser, is_active: e.target.checked})} className="w-5 h-5 rounded text-primary focus:ring-primary bg-black/50 border-white/20"/>
                <label htmlFor="active" className="text-sm font-bold text-white cursor-pointer">アカウントを有効にする</label>
              </div>
              <button type="submit" className="w-full py-3 mt-2 bg-primary text-gray-900 font-bold rounded-xl hover:bg-primary-hover transition-colors shadow-[0_0_15px_rgba(108,210,209,0.2)]">保存する</button>
            </form>
          </div>
        </div>
      )}

      {editingBook && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="glass-panel bg-gray-900 rounded-2xl p-8 w-full max-w-sm space-y-6 relative border border-white/10 shadow-2xl">
            <button onClick={() => setEditingBook(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={24}/></button>
            <h3 className="font-bold text-xl text-white">書籍編集</h3>
            <form onSubmit={handleUpdateBook} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">タイトル</label>
                <input required value={editingBook.title} onChange={e=>setEditingBook({...editingBook, title: e.target.value})} className="w-full p-3 glass-input rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">著者</label>
                <input value={editingBook.author || ''} onChange={e=>setEditingBook({...editingBook, author: e.target.value})} className="w-full p-3 glass-input rounded-xl" />
              </div>
              <button type="submit" className="w-full py-3 mt-2 bg-primary text-gray-900 font-bold rounded-xl hover:bg-primary-hover transition-colors shadow-[0_0_15px_rgba(108,210,209,0.2)]">保存する</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
