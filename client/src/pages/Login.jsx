import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHomePath } from '../utils/roleHome';
import { BookOpenIcon } from '../components/icons';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      navigate(roleHomePath(loggedInUser.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center mb-4">
        <BookOpenIcon className="w-5 h-5" />
      </div>
      <h1 className="text-xl font-semibold mb-1">Welcome back</h1>
      <p className="text-sm text-slate-400 mb-4">Log in to continue learning.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 text-white rounded-md py-2 hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="text-sm text-slate-500 mt-4">
        No account?{' '}
        <Link to="/register" className="text-indigo-600">
          Sign up
        </Link>
      </p>
    </div>
  );
}
