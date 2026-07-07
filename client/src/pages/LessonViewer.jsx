import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import AITutorChat from '../components/AITutorChat';
import LessonDiscussion from '../components/LessonDiscussion';

export default function LessonViewer() {
  const { courseId, lessonId } = useParams();
  const [lesson, setLesson] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completeError, setCompleteError] = useState('');
  const staleRef = useRef(false);

  // Guards against a stale response overwriting fresher state if the user
  // navigates between lessons quickly (e.g. rapid "next lesson" clicks).
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [lessonRes, enrollRes] = await Promise.all([
        api.get(`/lessons/${lessonId}`),
        api.get(`/enrollments/course/${courseId}`),
      ]);
      if (staleRef.current) return;
      setLesson(lessonRes.data.lesson);
      const completedLessons = enrollRes.data.enrollment?.completedLessons || [];
      setCompleted(completedLessons.map(String).includes(lessonId));
    } catch (err) {
      if (!staleRef.current) setError(err.response?.data?.message || 'Could not load this lesson.');
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    staleRef.current = false;
    load();
    return () => {
      staleRef.current = true;
    };
  }, [load]);

  const handleComplete = async () => {
    setCompleting(true);
    setCompleteError('');
    try {
      await api.post(`/enrollments/course/${courseId}/lessons/${lessonId}/complete`);
      setCompleted(true);
    } catch (err) {
      setCompleteError(err.response?.data?.message || 'Could not save your progress. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <p className="text-slate-400">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!lesson) return <p className="text-slate-400">Lesson not found.</p>;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <Link to={`/courses/${courseId}`} className="text-sm text-indigo-600">
          ← Back to course
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{lesson.title}</h1>

        {lesson.videoUrl && (
          <div className="mt-4 aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              src={lesson.videoUrl}
              title={lesson.title}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        )}

        <div className="mt-4 bg-white border border-slate-200 rounded-lg p-6 whitespace-pre-wrap text-slate-700 leading-relaxed">
          {lesson.content}
        </div>

        {lesson.attachments?.length > 0 && (
          <div className="mt-4 bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Attachments</h3>
            <ul className="space-y-1">
              {lesson.attachments.map((att) => (
                <li key={att._id} className="text-sm">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {att.originalName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleComplete}
          disabled={completing || completed}
          className="mt-4 bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-700 disabled:opacity-60"
        >
          {completed ? 'Completed ✓' : completing ? 'Saving...' : 'Mark lesson complete'}
        </button>
        {completeError && <p className="text-sm text-red-600 mt-2">{completeError}</p>}

        <LessonDiscussion courseId={courseId} lessonId={lessonId} />
      </div>

      <div>
        <AITutorChat courseId={courseId} />
      </div>
    </div>
  );
}
