import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { downloadCertificate } from '../api/certificates';
import { useAuth } from '../context/AuthContext';
import CourseThumbnail from '../components/CourseThumbnail';
import EmptyState from '../components/EmptyState';
import { BookOpenIcon, TrophyIcon } from '../components/icons';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrorId, setDownloadErrorId] = useState(null);

  const handleDownloadCertificate = async (e, courseId) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloadingId(courseId);
    setDownloadErrorId(null);
    try {
      await downloadCertificate(courseId);
    } catch {
      setDownloadErrorId(courseId);
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    api
      .get('/enrollments/me')
      .then((res) => setEnrollments(res.data.enrollments))
      .catch(() => setError('Could not load your courses. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  const completedCount = enrollments.filter((e) => e.progressPercent === 100).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">
        {enrollments.length === 0
          ? 'Pick a course to get started.'
          : `${enrollments.length} course${enrollments.length === 1 ? '' : 's'} in progress${
              completedCount ? ` · ${completedCount} completed` : ''
            }`}
      </p>
      {enrollments.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="No courses yet"
          message="Once you enroll in a course, it'll show up here with your progress."
          actionTo="/"
          actionLabel="Browse courses"
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {enrollments.map((enr) => (
            <Link
              key={enr._id}
              to={`/courses/${enr.course._id}`}
              className="block bg-white border border-slate-200 rounded-lg p-4 hover:shadow-lg hover:-translate-y-0.5 transition"
            >
              <CourseThumbnail course={enr.course} className="h-24" />
              <h2 className="font-semibold mt-3">{enr.course.title}</h2>
              <p className="text-sm text-slate-500 line-clamp-2">{enr.course.description}</p>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${enr.progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{enr.progressPercent}% complete</p>
              {enr.progressPercent === 100 && (
                <>
                  <button
                    onClick={(e) => handleDownloadCertificate(e, enr.course._id)}
                    disabled={downloadingId === enr.course._id}
                    className="text-xs text-emerald-600 hover:underline mt-2 disabled:opacity-60 flex items-center gap-1"
                  >
                    <TrophyIcon className="w-3.5 h-3.5" />
                    {downloadingId === enr.course._id ? 'Preparing...' : 'Download certificate'}
                  </button>
                  {downloadErrorId === enr.course._id && (
                    <p className="text-xs text-red-600 mt-1">Download failed. Please try again.</p>
                  )}
                </>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
