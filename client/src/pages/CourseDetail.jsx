import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { downloadCertificate } from '../api/certificates';
import { useAuth } from '../context/AuthContext';
import CourseThumbnail from '../components/CourseThumbnail';
import EmptyState from '../components/EmptyState';
import { BookOpenIcon, ClipboardListIcon, LockIcon, TrophyIcon, CheckCircleIcon } from '../components/icons';

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const staleRef = useRef(false);

  // Guards against a stale response overwriting fresher state: if the user
  // navigates from one course to another quickly, an in-flight request for
  // the old :id can resolve after the new :id's request already has, which
  // without this would briefly show the wrong course's data.
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/courses/${id}`);
      if (staleRef.current) return;
      setData(res.data);
      if (user?.role === 'student') {
        const enrRes = await api.get(`/enrollments/course/${id}`);
        if (staleRef.current) return;
        setEnrollment(enrRes.data.enrollment);
      }
    } catch (err) {
      if (!staleRef.current) setError(err.response?.data?.message || 'Could not load this course.');
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    staleRef.current = false;
    load();
    return () => {
      staleRef.current = true;
    };
  }, [load]);

  const handleEnroll = async () => {
    setEnrolling(true);
    setActionError('');
    try {
      const res = await api.post(`/enrollments/course/${id}`);
      setEnrollment(res.data.enrollment);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not enroll in this course. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleDownloadCertificate = async () => {
    setDownloadingCert(true);
    setActionError('');
    try {
      await downloadCertificate(id);
    } catch {
      setActionError('Could not download the certificate. Please try again.');
    } finally {
      setDownloadingCert(false);
    }
  };

  if (loading) return <p className="text-slate-400">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return <p className="text-slate-400">Course not found.</p>;

  const { course, lessons, quizzes } = data;
  const isEnrolled = Boolean(enrollment);
  const completedSet = new Set((enrollment?.completedLessons || []).map(String));

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <CourseThumbnail course={course} className="h-40" />
        <span className="text-xs font-medium text-indigo-600 uppercase inline-block mt-4">
          {course.category}
        </span>
        <h1 className="text-2xl font-semibold mt-1">{course.title}</h1>
        <p className="text-slate-600 mt-2">{course.description}</p>
        <p className="text-sm text-slate-400 mt-2">Tutor: {course.tutor?.name}</p>

        <h2 className="font-semibold mt-6 mb-2">Lessons</h2>
        {lessons.length === 0 ? (
          <EmptyState icon={BookOpenIcon} title="No lessons yet" message="The tutor hasn't added any lessons to this course yet." />
        ) : (
          <ul className="space-y-2">
            {lessons.map((lesson) => (
              <li
                key={lesson._id}
                className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-4 py-2.5 hover:border-indigo-200 transition"
              >
                <span className="flex items-center gap-2">
                  {completedSet.has(lesson._id) ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <BookOpenIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  {lesson.title}
                </span>
                {isEnrolled ? (
                  <Link
                    to={`/courses/${course._id}/lessons/${lesson._id}`}
                    className="text-sm text-indigo-600 font-medium"
                  >
                    View
                  </Link>
                ) : (
                  <span className="text-xs text-slate-300 flex items-center gap-1">
                    <LockIcon className="w-3.5 h-3.5" />
                    Enroll to view
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {quizzes.length > 0 && (
          <>
            <h2 className="font-semibold mt-6 mb-2">Quizzes</h2>
            <ul className="space-y-2">
              {quizzes.map((quiz) => (
                <li
                  key={quiz._id}
                  className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-4 py-2.5 hover:border-indigo-200 transition"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardListIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    {quiz.title}
                  </span>
                  {isEnrolled ? (
                    <Link to={`/quizzes/${quiz._id}`} className="text-sm text-indigo-600 font-medium">
                      Take quiz
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-300 flex items-center gap-1">
                      <LockIcon className="w-3.5 h-3.5" />
                      Enroll to take
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 h-fit">
        {!user ? (
          <p className="text-sm text-slate-500">
            <Link to="/login" className="text-indigo-600">
              Log in
            </Link>{' '}
            as a student to enroll.
          </p>
        ) : user.role !== 'student' ? (
          <p className="text-sm text-slate-500">Only students can enroll in courses.</p>
        ) : isEnrolled ? (
          <div>
            <p className="text-sm text-slate-600 mb-2">
              Progress: <span className="font-semibold">{enrollment.progressPercent}%</span>
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${enrollment.progressPercent}%` }}
              />
            </div>
            {enrollment.progressPercent === 100 && (
              <button
                onClick={handleDownloadCertificate}
                disabled={downloadingCert}
                className="w-full mt-4 bg-emerald-600 text-white rounded-md py-2 hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                <TrophyIcon className="w-4 h-4" />
                {downloadingCert ? 'Preparing...' : 'Download Certificate'}
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full bg-indigo-600 text-white rounded-md py-2 hover:bg-indigo-700 disabled:opacity-60"
          >
            {enrolling ? 'Enrolling...' : 'Enroll in course'}
          </button>
        )}
        {actionError && <p className="text-sm text-red-600 mt-2">{actionError}</p>}
      </div>
    </div>
  );
}
