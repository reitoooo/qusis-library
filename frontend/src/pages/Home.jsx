import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiUrl } from '../api';
import { Search, ArrowUpCircle, ArrowDownCircle, Loader2, Zap } from 'lucide-react';

export default function Home() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await fetch(getApiUrl(`/api/books/${query}`));
        if (res.ok) {
          const data = await res.json();
          setBooks(data);
        }
      } catch (err) {
        console.error('Failed to fetch books', err);
      } finally {
        setLoading(false);
      }
    };

    if (!search) {
      fetchBooks();
      return;
    }

    const timer = setTimeout(() => {
      fetchBooks();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const goToLend = (book) => {
    const params = new URLSearchParams({
      book_id: book.id,
      book_title: book.title,
      isbn: book.isbn || '',
    });
    navigate(`/lend?${params.toString()}`);
  };

  const goToReturn = (book) => {
    const params = new URLSearchParams({
      book_id: book.id,
      book_title: book.title,
      isbn: book.isbn || '',
    });
    navigate(`/return?${params.toString()}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-3 pt-6 mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4 shadow-[0_0_30px_rgba(108,210,209,0.2)]">
          <Zap className="text-primary" size={32} />
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight" style={{ textShadow: '0 0 40px rgba(108,210,209,0.4)' }}>
          QUSIS LIBRARY
        </h1>
      </div>

      <div className="flex gap-4 justify-center py-6">
        <Link to="/lend" className="glass-panel flex flex-col items-center gap-3 p-8 rounded-2xl flex-1 max-w-[220px] group cursor-pointer hover:scale-105">
          <div className="p-4 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-gray-900 transition-colors">
            <ArrowUpCircle size={36} />
          </div>
          <span className="font-bold text-lg text-white">借りる</span>
        </Link>
        <Link to="/return" className="glass-panel flex flex-col items-center gap-3 p-8 rounded-2xl flex-1 max-w-[220px] group cursor-pointer hover:scale-105">
          <div className="p-4 bg-white/5 text-gray-300 rounded-xl group-hover:bg-white group-hover:text-gray-900 transition-colors">
            <ArrowDownCircle size={36} />
          </div>
          <span className="font-bold text-lg text-white">返す</span>
        </Link>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="書籍名や著者で検索..."
            className="w-full pl-12 pr-4 py-4 glass-input rounded-xl text-lg font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="absolute left-4 top-4.5 text-gray-400" size={24} />
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-primary">
            <Loader2 className="animate-spin" size={40} />
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-medium">
            本が見つかりませんでした
          </div>
        ) : (
          <div className="space-y-3">
            {books.map((book) => {
              const available = book.status === '貸出可能';
              return (
                <div
                  key={book.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-xl gap-3"
                >
                  {/* Book info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-base leading-snug truncate">{book.title}</h3>
                    <p className="text-sm text-gray-400 mt-0.5 truncate">{book.author}</p>
                  </div>

                  {/* Status + action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider ${
                        available
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {book.status}
                    </span>

                    {available ? (
                      <button
                        onClick={() => goToLend(book)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold hover:bg-primary hover:text-gray-900 transition-all"
                        title="この本を借りる"
                      >
                        <ArrowUpCircle size={13} />
                        借りる
                      </button>
                    ) : book.status === '貸出中' ? (
                      <button
                        onClick={() => goToReturn(book)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-gray-300 border border-white/10 rounded-full text-xs font-bold hover:bg-white/20 transition-all"
                        title="この本を返却する"
                      >
                        <ArrowDownCircle size={13} />
                        返す
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
