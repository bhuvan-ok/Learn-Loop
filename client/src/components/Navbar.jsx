import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpenIcon } from './icons';

const ROLE_BADGE_STYLES = {
  student: 'bg-indigo-100 text-indigo-700',
  tutor: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-amber-100 text-amber-700',
};

function Avatar({ name, role }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const style = ROLE_BADGE_STYLES[role] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${style}`}>
      {initial}
    </span>
  );
}

function NavLinks({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onNavigate?.();
    navigate('/');
  };

  return (
    <>
      <Link to="/" onClick={onNavigate} className="text-slate-600 hover:text-slate-900">
        Courses
      </Link>
      {user?.role === 'student' && (
        <Link to="/dashboard" onClick={onNavigate} className="text-slate-600 hover:text-slate-900">
          Dashboard
        </Link>
      )}
      {(user?.role === 'tutor' || user?.role === 'admin') && (
        <Link to="/tutor" onClick={onNavigate} className="text-slate-600 hover:text-slate-900">
          Tutor Studio
        </Link>
      )}
      {user?.role === 'admin' && (
        <Link to="/admin" onClick={onNavigate} className="text-slate-600 hover:text-slate-900">
          Admin Panel
        </Link>
      )}
      {user ? (
        <>
          <span className="flex items-center gap-2">
            <Avatar name={user.name} role={user.role} />
            <span className="text-slate-600">{user.name}</span>
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-medium ${
                ROLE_BADGE_STYLES[user.role] || 'bg-slate-100 text-slate-600'
              }`}
            >
              {user.role}
            </span>
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-left"
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <Link to="/login" onClick={onNavigate} className="text-slate-600 hover:text-slate-900">
            Login
          </Link>
          <Link
            to="/register"
            onClick={onNavigate}
            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-center"
          >
            Sign up
          </Link>
        </>
      )}
    </>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900 text-lg">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center">
            <BookOpenIcon className="w-4 h-4" />
          </span>
          LearnLoop
        </Link>

        <div className="hidden md:flex items-center gap-4 text-sm">
          <NavLinks />
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-slate-600"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-slate-200 px-4 py-3 flex flex-col gap-3 text-sm">
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </div>
      )}
    </nav>
  );
}
