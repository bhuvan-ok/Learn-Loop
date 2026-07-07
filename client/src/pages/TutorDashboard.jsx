import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import { BookOpenIcon, PlusIcon } from '../components/icons';

export default function TutorDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get('/courses/mine')
      .then((res) => setCourses(res.data.courses))
      .catch(() => setError('Could not load your courses. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePublish = async (course) => {
    setActionError('');
    try {
      await api.patch(`/courses/${course._id}/publish`, { published: !course.published });
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update this course. Please try again.');
    }
  };

  const removeCourse = async (course) => {
    if (!confirm(`Delete "${course.title}"? This removes all its lessons and quizzes.`)) return;
    setActionError('');
    try {
      await api.delete(`/courses/${course._id}`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not delete this course. Please try again.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Tutor Studio</h1>
        <Link
          to="/tutor/courses/new"
          className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm hover:bg-indigo-700 flex items-center gap-1.5"
        >
          <PlusIcon className="w-4 h-4" />
          New Course
        </Link>
      </div>
      <p className="text-slate-500 text-sm mb-4">
        {courses.length > 0
          ? `${courses.length} course${courses.length === 1 ? '' : 's'} · ${courses.filter((c) => c.published).length} published`
          : 'Create and manage the courses you teach.'}
      </p>

      {actionError && <p className="text-red-600 text-sm mb-3">{actionError}</p>}

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="No courses yet"
          message="Create your first course to start adding lessons, quizzes, and reach students."
          actionTo="/tutor/courses/new"
          actionLabel="Create a course"
        />
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <div
              key={course._id}
              className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-200 transition"
            >
              <div>
                <h2 className="font-semibold">{course.title}</h2>
                <p className="text-sm text-slate-500">{course.category}</p>
                <span
                  className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                    course.published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {course.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link to={`/tutor/courses/${course._id}`} className="text-indigo-600">
                  Manage
                </Link>
                <button onClick={() => togglePublish(course)} className="text-slate-500">
                  {course.published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => removeCourse(course)} className="text-red-500">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
