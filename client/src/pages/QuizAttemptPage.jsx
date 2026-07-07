import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { TrophyIcon } from '../components/icons';

export default function QuizAttemptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const staleRef = useRef(false);

  // Guards against a stale response overwriting fresher state: without this,
  // navigating from one quiz straight to another (back button, or clicking a
  // different "Take quiz" link before the first request finishes) can let an
  // in-flight request for the OLD quiz id resolve after the new one already
  // has, silently swapping in the wrong quiz's questions under the URL for
  // the new one — and the student could submit answers for a quiz other than
  // the one they think they're taking.
  useEffect(() => {
    staleRef.current = false;
    setLoading(true);
    setLoadError('');
    setResult(null);
    api
      .get(`/quizzes/${id}`)
      .then((res) => {
        if (staleRef.current) return;
        setQuiz(res.data.quiz);
        setAnswers(new Array(res.data.quiz.questions.length).fill(null));
      })
      .catch((err) => {
        if (!staleRef.current) {
          setLoadError(err.response?.data?.message || 'Could not load this quiz.');
        }
      })
      .finally(() => {
        if (!staleRef.current) setLoading(false);
      });
    return () => {
      staleRef.current = true;
    };
  }, [id]);

  const selectAnswer = (qIndex, optIndex) => {
    const copy = [...answers];
    copy[qIndex] = optIndex;
    setAnswers(copy);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (answers.some((a) => a === null)) {
      setError('Please answer every question before submitting.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/quizzes/${id}/attempt`, { answers });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-slate-400">Loading quiz...</p>;
  if (loadError) return <p className="text-red-600 text-sm">{loadError}</p>;
  if (!quiz) return <p className="text-slate-400">Quiz not found.</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">{quiz.title}</h1>

      {result ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          {(() => {
            const passed = result.attempt.score / result.attempt.total >= 0.6;
            return (
              <div
                className={`flex items-center gap-3 rounded-lg p-4 mb-4 ${
                  passed ? 'bg-emerald-50' : 'bg-amber-50'
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    passed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  <TrophyIcon className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-lg font-semibold">
                    Score: {result.attempt.score} / {result.attempt.total}
                  </p>
                  <p className="text-xs text-slate-500">
                    {passed ? 'Nice work!' : 'Review the material and try again anytime.'}
                  </p>
                </div>
              </div>
            );
          })()}
          <ul className="space-y-3">
            {result.breakdown.map((b, i) => (
              <li key={i} className={`p-3 rounded-md ${b.correct ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm font-medium">{b.questionText}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {b.correct ? 'Correct' : `Incorrect — your answer was option ${b.yourAnswer + 1}`}
                </p>
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate(-1)}
            className="inline-block mt-4 text-indigo-600 text-sm"
          >
            ← Back
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {quiz.questions.map((q, qi) => (
            <div key={q._id} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="font-medium mb-2">
                {qi + 1}. {q.questionText}
              </p>
              <div className="space-y-1">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${qi}`}
                      checked={answers[qi] === oi}
                      onChange={() => selectAnswer(qi, oi)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit quiz'}
          </button>
        </form>
      )}
    </div>
  );
}
