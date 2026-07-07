import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import { UsersIcon, BookOpenIcon, CheckCircleIcon, ClipboardListIcon } from '../components/icons';

const STAT_ACCENTS = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
};

function StatCard({ label, value, icon: IconComponent, accent = 'indigo' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-start justify-between">
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
      {IconComponent && (
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${STAT_ACCENTS[accent]}`}>
          <IconComponent className="w-5 h-5" />
        </span>
      )}
    </div>
  );
}

function UsersTable({ users, currentUserId, onRoleChange }) {
  return (
    <table className="w-full text-sm bg-white border border-slate-200 rounded-lg overflow-hidden">
      <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
        <tr>
          <th className="px-4 py-2">Name</th>
          <th className="px-4 py-2">Email</th>
          <th className="px-4 py-2">Role</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u._id} className="border-t border-slate-100">
            <td className="px-4 py-2">{u.name}</td>
            <td className="px-4 py-2 text-slate-500">{u.email}</td>
            <td className="px-4 py-2">
              {u._id === currentUserId ? (
                <span className="text-slate-400">{u.role} (you)</span>
              ) : (
                <select
                  value={u.role}
                  onChange={(e) => onRoleChange(u._id, e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1 text-sm"
                >
                  <option value="student">student</option>
                  <option value="tutor">tutor</option>
                  <option value="admin">admin</option>
                </select>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CoursesTable({ courses, onTogglePublish, onDelete }) {
  return (
    <table className="w-full text-sm bg-white border border-slate-200 rounded-lg overflow-hidden">
      <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
        <tr>
          <th className="px-4 py-2">Title</th>
          <th className="px-4 py-2">Tutor</th>
          <th className="px-4 py-2">Status</th>
          <th className="px-4 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {courses.map((c) => (
          <tr key={c._id} className="border-t border-slate-100">
            <td className="px-4 py-2">{c.title}</td>
            <td className="px-4 py-2 text-slate-500">{c.tutor?.name || 'Unknown'}</td>
            <td className="px-4 py-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  c.published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {c.published ? 'Published' : 'Draft'}
              </span>
            </td>
            <td className="px-4 py-2 space-x-3">
              <button onClick={() => onTogglePublish(c)} className="text-indigo-600 text-xs">
                {c.published ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => onDelete(c)} className="text-red-500 text-xs">
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, coursesRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/courses'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setCourses(coursesRes.data.courses);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRoleChange = async (userId, role) => {
    setActionError('');
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update this user\'s role. Please try again.');
    }
  };

  const handleTogglePublish = async (course) => {
    setActionError('');
    try {
      await api.patch(`/courses/${course._id}/publish`, { published: !course.published });
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update this course. Please try again.');
    }
  };

  const handleDelete = async (course) => {
    if (!confirm(`Delete "${course.title}"? This removes all its lessons and quizzes.`)) return;
    setActionError('');
    try {
      await api.delete(`/courses/${course._id}`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not delete this course. Please try again.');
    }
  };

  if (loading) return <p className="text-slate-400">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin Panel</h1>
        <p className="text-slate-500 text-sm mt-1">Platform-wide stats, users, and courses.</p>
      </div>

      {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total users" value={stats.users.total} icon={UsersIcon} accent="indigo" />
        <StatCard label="Students" value={stats.users.student} icon={UsersIcon} accent="sky" />
        <StatCard label="Tutors" value={stats.users.tutor} icon={UsersIcon} accent="emerald" />
        <StatCard label="Admins" value={stats.users.admin} icon={UsersIcon} accent="amber" />
        <StatCard label="Total courses" value={stats.courses.total} icon={BookOpenIcon} accent="indigo" />
        <StatCard label="Published courses" value={stats.courses.published} icon={CheckCircleIcon} accent="emerald" />
        <StatCard label="Enrollments" value={stats.totalEnrollments} icon={UsersIcon} accent="sky" />
        <StatCard label="Quiz attempts" value={stats.totalQuizAttempts} icon={ClipboardListIcon} accent="amber" />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Users</h2>
        {users.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users yet" />
        ) : (
          <UsersTable users={users} currentUserId={user.id} onRoleChange={handleRoleChange} />
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2">All Courses</h2>
        {courses.length === 0 ? (
          <EmptyState icon={BookOpenIcon} title="No courses yet" message="Courses created by tutors will appear here." />
        ) : (
          <CoursesTable courses={courses} onTogglePublish={handleTogglePublish} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
