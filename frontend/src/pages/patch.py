import os

file_path = r"c:\Users\njaii\OneDrive\Apps\蔵書管理アプリ\frontend\src\pages\Admin.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Let's normalize CRLF to LF for replacement ease, then we can write it back (Python will write native CRLF if we open in 'w' on Windows)
content = content.replace('\r\n', '\n')

# ----------------- REPLACE 1: User Table Header and selected bar -----------------
target_1 = """                <div className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[500px]">
                    <thead className="bg-white/5 border-b border-white/10 text-gray-300">
                      <tr>
                        <th className="p-4">学籍番号</th>
                        <th className="p-4">氏名</th>
                        <th className="p-4">Slack ID</th>
                        <th className="p-4">状態</th>
                        <th className="p-4 w-24 text-center">操作</th>
                      </tr>
                    </thead>"""

replacement_1 = """                {selectedUserIds.length > 0 && (
                  <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-4 animate-in slide-in-from-top-2">
                    <span className="text-sm font-bold text-red-400">
                      {selectedUserIds.length} 名を選択中
                    </span>
                    <button 
                      onClick={handleBulkDeleteUsers}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20"
                    >
                      <Trash2 size={14}/> 選択したユーザーを一括削除
                    </button>
                  </div>
                )}
                
                <div className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[500px]">
                    <thead className="bg-white/5 border-b border-white/10 text-gray-300">
                      <tr>
                        <th className="p-4 w-12 text-center">
                          <input 
                            type="checkbox" 
                            checked={users.length > 0 && selectedUserIds.length === users.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds(users.map(u => u.user_id));
                              } else {
                                setSelectedUserIds([]);
                              }
                            }}
                            className="w-4 h-4 rounded text-primary focus:ring-primary bg-black/50 border-white/20"
                          />
                        </th>
                        <th className="p-4">学籍番号</th>
                        <th className="p-4">氏名</th>
                        <th className="p-4">Slack ID</th>
                        <th className="p-4">状態</th>
                        <th className="p-4 w-24 text-center">操作</th>
                      </tr>
                    </thead>"""

if target_1 in content:
    content = content.replace(target_1, replacement_1)
    print("Replacement 1 successful!")
else:
    print("Replacement 1 FAILED: Target not found.")

# ----------------- REPLACE 2: User Table Body -----------------
target_2 = """                      {loading ? (
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
                      )}"""

replacement_2 = """                      {loading ? (
                        <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary"/></td></tr>
                      ) : users.length > 0 ? users.map(u => (
                        <tr key={u.user_id} className={`border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${selectedUserIds.includes(u.user_id) ? 'bg-primary/5' : ''}`}>
                          <td className="p-4 w-12 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedUserIds.includes(u.user_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds([...selectedUserIds, u.user_id]);
                                } else {
                                  setSelectedUserIds(selectedUserIds.filter(id => id !== u.user_id));
                                }
                              }}
                              className="w-4 h-4 rounded text-primary focus:ring-primary bg-black/50 border-white/20"
                            />
                          </td>
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
                        <tr><td colSpan="6" className="p-8 text-center text-gray-500">ユーザーがいません</td></tr>
                      )}"""

if target_2 in content:
    content = content.replace(target_2, replacement_2)
    print("Replacement 2 successful!")
else:
    print("Replacement 2 FAILED: Target not found.")

# ----------------- REPLACE 3: Confirmation Modals -----------------
target_3 = """      {/* --- Edit Modals --- */}
      {editingUser && ("""

replacement_3 = """      {/* --- Confirmation Modals --- */}
      {confirmData && confirmData.type === 'single' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="glass-panel bg-gray-900 rounded-2xl p-8 w-full max-w-sm space-y-6 relative border border-white/10 shadow-2xl">
            <button onClick={() => setConfirmData(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={24}/></button>
            <h3 className="font-bold text-xl text-white">登録内容の確認</h3>
            
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div>
                  <span className="text-gray-400 text-xs block">学籍番号</span>
                  <span className="font-mono text-white font-bold">{confirmData.user_id}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">氏名</span>
                  {confirmData.isUpdate ? (
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 line-through">{confirmData.existing?.name}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-primary font-bold">{confirmData.name}</span>
                    </div>
                  ) : (
                    <span className="text-white font-bold">{confirmData.name}</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">Slack ID</span>
                  {confirmData.isUpdate ? (
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 line-through font-mono text-xs">{confirmData.existing?.notification_id || '-'}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-primary font-bold font-mono text-xs">{confirmData.notification_id || '-'}</span>
                    </div>
                  ) : (
                    <span className="text-white font-mono text-xs">{confirmData.notification_id || '-'}</span>
                  )}
                </div>
              </div>
              
              {confirmData.isUpdate ? (
                confirmData.hasChanges ? (
                  <p className="text-amber-400 text-xs flex items-center gap-1.5 bg-amber-500/10 p-2.5 border border-amber-500/20 rounded-lg">
                    <AlertCircle size={14} className="shrink-0"/>
                    この学籍番号は既に登録されています。変更内容で上書き更新しますか？
                  </p>
                ) : (
                  <p className="text-gray-400 text-xs flex items-center gap-1.5 bg-white/5 p-2.5 border border-white/10 rounded-lg">
                    <Check size={14} className="shrink-0 text-primary"/>
                    入力内容は既存の登録内容と同一です。
                  </p>
                )
              ) : (
                <p className="text-gray-400 text-xs flex items-center gap-1.5 bg-white/5 p-2.5 border border-white/10 rounded-lg">
                  <Check size={14} className="shrink-0 text-primary"/>
                  新しいユーザーとしてシステムに登録します。
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setConfirmData(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-colors">キャンセル</button>
              <button onClick={handleConfirmSingleRegister} className="flex-1 py-3 bg-primary hover:bg-primary-hover text-gray-900 font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(108,210,209,0.2)]">
                {confirmData.isUpdate ? '更新する' : '登録する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmData && confirmData.type === 'csv' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="glass-panel bg-gray-900 rounded-2xl p-8 w-full max-w-md space-y-6 relative border border-white/10 shadow-2xl">
            <button onClick={() => setConfirmData(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={24}/></button>
            <h3 className="font-bold text-xl text-white">一括インポートの確認</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-2.5">
                  <span className="text-primary font-bold text-lg block">{confirmData.added.length}</span>
                  <span className="text-gray-400">新規追加</span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                  <span className="text-amber-400 font-bold text-lg block">{confirmData.updated.length}</span>
                  <span className="text-gray-400">情報更新</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <span className="text-gray-400 font-bold text-lg block">{confirmData.unchanged.length}</span>
                  <span className="text-gray-400">変更なし</span>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 border border-white/5 rounded-xl p-3 bg-black/20 text-xs">
                {confirmData.added.map(u => (
                  <div key={u.user_id} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex gap-2 items-center">
                      <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold text-[10px]">新規</span>
                      <span className="font-mono text-gray-300">{u.user_id}</span>
                    </div>
                    <span className="text-white font-bold">{u.name}</span>
                  </div>
                ))}
                {confirmData.updated.map(u => (
                  <div key={u.user_id} className="py-2 border-b border-white/5 last:border-0 space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2 items-center">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px]">更新</span>
                        <span className="font-mono text-gray-300">{u.user_id}</span>
                      </div>
                      <span className="text-white font-bold">{u.name}</span>
                    </div>
                    <div className="pl-8 text-[10px] text-gray-400 space-y-0.5">
                      {u.prevName !== u.name && (
                        <div>氏名: <span className="text-red-400 line-through">{u.prevName}</span> → <span className="text-primary">{u.name}</span></div>
                      )}
                      {(u.prevNotificationId || '') !== (u.notification_id || '') && (
                        <div>Slack ID: <span className="text-red-400 line-through">{u.prevNotificationId || '-'}</span> → <span className="text-primary">{u.notification_id || '-'}</span></div>
                      )}
                    </div>
                  </div>
                ))}
                {confirmData.unchanged.map(u => (
                  <div key={u.user_id} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0 opacity-50">
                    <div className="flex gap-2 items-center">
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-400 font-bold text-[10px]">変更無</span>
                      <span className="font-mono text-gray-400">{u.user_id}</span>
                    </div>
                    <span className="text-gray-400">{u.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setConfirmData(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-colors">キャンセル</button>
              <button onClick={handleConfirmCsvImport} className="flex-1 py-3 bg-primary hover:bg-primary-hover text-gray-900 font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(108,210,209,0.2)]">
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Edit Modals --- */}
      {editingUser && ("""

if target_3 in content:
    content = content.replace(target_3, replacement_3)
    print("Replacement 3 successful!")
else:
    print("Replacement 3 FAILED: Target not found.")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Finished processing.")
