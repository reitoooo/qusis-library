import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Lend from './pages/Lend';
import Reserve from './pages/Reserve';
import Return from './pages/Return';
import MyPage from './pages/MyPage';
import Admin from './pages/Admin';
import { BookOpen } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-transparent flex flex-col">
        <header className="border-b border-white/10 backdrop-blur-md bg-black/20 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="text-lg font-bold flex items-center gap-2 text-white">
              <BookOpen size={20} className="text-primary" />
              蔵書管理システム
            </Link>
            <nav className="flex gap-6 text-sm font-bold tracking-wider">
              <Link to="/mypage" className="text-gray-400 hover:text-primary transition-colors">マイページ</Link>
              <Link to="/admin" className="text-gray-400 hover:text-primary transition-colors">管理</Link>
            </nav>
          </div>
        </header>
        
        <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lend" element={<Lend />} />
            <Route path="/reserve" element={<Reserve />} />
            <Route path="/return" element={<Return />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        
        <footer className="border-t border-white/5 py-6 text-center text-xs font-mono text-gray-600">
          &copy; 2026 QUSIS LIBRARY
        </footer>
      </div>
    </Router>
  );
}

export default App;
