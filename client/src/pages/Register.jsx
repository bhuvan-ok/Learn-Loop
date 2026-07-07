import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHomePath } from '../utils/roleHome';
import { SparklesIcon } from '../components/icons';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const registeredUser = await register(form.name, form.email, form.password, form.role);
      navigate(roleHomePath(registeredUser.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center mb-4">
        <SparklesIcon className="w-5 h-5" />
      </div>
      <h1 className="text-xl font-semibold mb-1">Create your account</h1>
      <p className="text-sm text-slate-400 mb-4">Join as a student or a tutor.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={update('name')}
            className="w-full border border-slate-300 rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={update('email')}
            className="w-full border border-slate-300 rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={update('password')}
            className="w-full border border-slate-300 rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">I am a...</label>
          <select
            value={form.role}
            onChange={update('role')}
            className="w-full border border-slate-300 rounded-md px-3 py-2"
          >
            <option value="student">Student</option>
            <option value="tutor">Tutor</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 text-white rounded-md py-2 hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Creating...' : 'Sign up'}
        </button>
      </form>
      <p className="text-sm text-slate-500 mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600">
          Log in
        </Link>
      </p>
    </div>
  );
}
