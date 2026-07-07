import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

function CourseInfoForm({ course, onSaved }) {
  const [form, setForm] = useState({
    title: course?.title || '',
    description: course?.description || '',
    category: course?.category || 'General',
    thumbnailUrl: course?.thumbnailUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (course) {
        const res = await api.put(`/courses/${course._id}`, form);
        onSaved(res.data.course);
      } else {
        const res = await api.post('/courses', form);
        onSaved(res.data.course);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-sm text-slate-600 mb-1">Title</label>
        <input
          required
          value={form.title}
          onChange={update('title')}
          className="w-full border border-slate-300 rounded-md px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">Description</label>
        <textarea
          required
          rows={3}
          value={form.description}
          onChange={update('description')}
          className="w-full border border-slate-300 rounded-md px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Category</label>
          <input
            value={form.category}
            onChange={update('category')}
            className="w-full border border-slate-300 rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Thumbnail URL</label>
          <input
            value={form.thumbnailUrl}
            onChange={update('thumbnailUrl')}
            className="w-full border border-slate-300 rounded-md px-3 py-2"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'Saving...' : course ? 'Save changes' : 'Create course'}
      </button>
    </form>
  );
}

function AttachmentsPanel({ lesson, onChange }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/lessons/${lesson._id}/attachments`, formData);
      onChange({ ...lesson, attachments: [...lesson.attachments, res.data.attachment] });
      setFile(null);
      e.target.reset();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!confirm('Delete this file? It will also be removed from the AI tutor index.')) return;
    try {
      await api.delete(`/lessons/${lesson._id}/attachments/${attachmentId}`);
      onChange({ ...lesson, attachments: lesson.attachments.filter((a) => a._id !== attachmentId) });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete this file. Please try again.');
    }
  };

  return (
    <div className="mt-2 pl-3 border-l-2 border-slate-100 space-y-1.5">
      {lesson.attachments.map((att) => (
        <div key={att._id} className="flex items-center justify-between text-xs">
          <a
            href={att.url}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline"
          >
            {att.originalName}
            {att.indexedForRag && <span className="text-slate-400"> · indexed for AI tutor</span>}
          </a>
          <button onClick={() => handleDelete(att._id)} className="text-red-500">
            Remove
          </button>
        </div>
      ))}
      <form onSubmit={handleUpload} className="flex items-center gap-2">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          className="text-xs flex-1"
          accept=".pdf,.txt,.md,.png,.jpg,.jpeg"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="text-xs text-indigo-600 disabled:opacity-40 whitespace-nowrap"
        >
          {uploading ? 'Uploading...' : '+ Add file'}
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function AddLessonForm({ courseId, nextOrder, onAdded }) {
  const [form, setForm] = useState({ title: '', content: '', videoUrl: '', order: nextOrder });
  const [saving, setSaving] = useState(false);
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post(`/courses/${courseId}/lessons`, {
        ...form,
        order: Number(form.order),
      });
      onAdded(res.data.lesson);
      setForm({ title: '', content: '', videoUrl: '', order: nextOrder + 1 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <h3 className="font-medium text-sm">Add a lesson</h3>
      <input
        required
        placeholder="Lesson title"
        value={form.title}
        onChange={update('title')}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />
      <textarea
        required
        rows={5}
        placeholder="Lesson content (this gets indexed for the AI tutor)"
        value={form.content}
        onChange={update('content')}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Video URL (optional)"
          value={form.videoUrl}
          onChange={update('videoUrl')}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Order"
          value={form.order}
          onChange={update('order')}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'Adding & indexing for AI tutor...' : 'Add lesson'}
      </button>
    </form>
  );
}

function AddQuizForm({ courseId, onAdded }) {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([
    { questionText: '', options: ['', ''], correctOptionIndex: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const updateQuestion = (qi, field, value) => {
    const copy = [...questions];
    copy[qi] = { ...copy[qi], [field]: value };
    setQuestions(copy);
  };

  const updateOption = (qi, oi, value) => {
    const copy = [...questions];
    const options = [...copy[qi].options];
    options[oi] = value;
    copy[qi] = { ...copy[qi], options };
    setQuestions(copy);
  };

  const addQuestion = () =>
    setQuestions([...questions, { questionText: '', options: ['', ''], correctOptionIndex: 0 }]);

  const addOption = (qi) => {
    const copy = [...questions];
    copy[qi] = { ...copy[qi], options: [...copy[qi].options, ''] };
    setQuestions(copy);
  };

  const removeQuestion = (qi) => setQuestions(questions.filter((_, i) => i !== qi));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post(`/courses/${courseId}/quizzes`, { title, questions });
      onAdded(res.data.quiz);
      setTitle('');
      setQuestions([{ questionText: '', options: ['', ''], correctOptionIndex: 0 }]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <h3 className="font-medium text-sm">Add a quiz</h3>
      <input
        required
        placeholder="Quiz title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />

      {questions.map((q, qi) => (
        <div key={qi} className="border border-slate-200 rounded-md p-3 space-y-2">
          <div className="flex gap-2">
            <input
              required
              placeholder={`Question ${qi + 1}`}
              value={q.questionText}
              onChange={(e) => updateQuestion(qi, 'questionText', e.target.value)}
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => removeQuestion(qi)}
                className="text-red-500 text-sm"
              >
                Remove
              </button>
            )}
          </div>
          {q.options.map((opt, oi) => (
            <label key={oi} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={q.correctOptionIndex === oi}
                onChange={() => updateQuestion(qi, 'correctOptionIndex', oi)}
              />
              <input
                required
                placeholder={`Option ${oi + 1}`}
                value={opt}
                onChange={(e) => updateOption(qi, oi, e.target.value)}
                className="flex-1 border border-slate-300 rounded-md px-2 py-1 text-sm"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => addOption(qi)}
            className="text-xs text-indigo-600"
          >
            + Add option
          </button>
        </div>
      ))}

      <button type="button" onClick={addQuestion} className="text-sm text-indigo-600">
        + Add question
      </button>

      <button
        type="submit"
        disabled={saving}
        className="block bg-indigo-600 text-white rounded-md px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Add quiz'}
      </button>
    </form>
  );
}

function QuizListItem({ quiz }) {
  const [answers, setAnswers] = useState(null);
  const [showing, setShowing] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    if (showing) {
      setShowing(false);
      return;
    }
    if (!answers) {
      try {
        const res = await api.get(`/quizzes/${quiz._id}/answers`);
        setAnswers(res.data.quiz);
      } catch {
        setError('Could not load answers. Please try again.');
        return;
      }
    }
    setError('');
    setShowing(true);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md px-4 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm">{quiz.title}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{quiz.questions.length} questions</span>
          <button onClick={toggle} className="text-xs text-indigo-600">
            {showing ? 'Hide answers' : 'View answers'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {showing && answers && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
          {answers.questions.map((q) => (
            <li key={q._id}>
              {q.questionText} — <span className="font-medium">{q.options[q.correctOptionIndex]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TutorCourseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const staleRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/courses/${id}`);
      if (staleRef.current) return;
      setCourse(res.data.course);
      setLessons(res.data.lessons);
      setQuizzes(res.data.quizzes);
    } catch (err) {
      if (!staleRef.current) setError(err.response?.data?.message || 'Could not load this course.');
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    staleRef.current = false;
    load();
    return () => {
      staleRef.current = true;
    };
  }, [load]);

  const handleCreated = (newCourse) => {
    navigate(`/tutor/courses/${newCourse._id}`);
  };

  const removeLesson = async (lessonId) => {
    if (!confirm('Delete this lesson? It will also be removed from the AI tutor index.')) return;
    try {
      await api.delete(`/lessons/${lessonId}`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete this lesson. Please try again.');
    }
  };

  const updateLessonInList = (updatedLesson) => {
    setLessons((prev) => prev.map((l) => (l._id === updatedLesson._id ? updatedLesson : l)));
  };

  if (loading) return <p className="text-slate-400">Loading...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  if (!id) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold mb-4">New Course</h1>
        <CourseInfoForm onSaved={handleCreated} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{course.title}</h1>

      <CourseInfoForm course={course} onSaved={setCourse} />

      <div>
        <h2 className="font-semibold mb-2">Lessons</h2>
        <div className="space-y-2 mb-3">
          {lessons.map((lesson) => (
            <div key={lesson._id} className="bg-white border border-slate-200 rounded-md px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  #{lesson.order} — {lesson.title}
                </span>
                <button onClick={() => removeLesson(lesson._id)} className="text-red-500 text-xs">
                  Delete
                </button>
              </div>
              <AttachmentsPanel lesson={lesson} onChange={updateLessonInList} />
            </div>
          ))}
        </div>
        <AddLessonForm
          courseId={id}
          nextOrder={lessons.length}
          onAdded={(lesson) => setLessons([...lessons, lesson])}
        />
      </div>

      <div>
        <h2 className="font-semibold mb-2">Quizzes</h2>
        <div className="space-y-2 mb-3">
          {quizzes.map((quiz) => (
            <QuizListItem key={quiz._id} quiz={quiz} />
          ))}
        </div>
        <AddQuizForm courseId={id} onAdded={(quiz) => setQuizzes([...quizzes, quiz])} />
      </div>
    </div>
  );
}
