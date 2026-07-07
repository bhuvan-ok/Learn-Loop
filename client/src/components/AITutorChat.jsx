import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

// If no data arrives for this long mid-stream, treat it as hung rather than
// leaving the UI stuck on "Thinking..." forever with no way to recover.
const STREAM_IDLE_TIMEOUT_MS = 30000;

let nextMessageId = 0;

export default function AITutorChat({ courseId }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    api
      .get(`/courses/${courseId}/chat`)
      .then((res) => {
        if (!ignore) setMessages(res.data.messages);
      })
      .finally(() => {
        if (!ignore) setLoadingHistory(false);
      });
    return () => {
      ignore = true;
    };
  }, [courseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cancel any in-flight stream on unmount or course change — otherwise a
  // student navigating away mid-answer leaves the fetch running and trying
  // to update state for a chat that's no longer on screen.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [courseId]);

  const appendToken = (id, token) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, answer: (m.answer || '') + token, pending: false } : m))
    );
  };

  const finishMessage = (id, patch) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, pending: false, ...patch } : m)));
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || asking) return;

    const q = question.trim();
    const id = nextMessageId++;
    setQuestion('');
    setAsking(true);
    setMessages((prev) => [...prev, { id, question: q, answer: '', citedChunks: [], pending: true }]);

    const controller = new AbortController();
    abortRef.current = controller;
    let idleTimer;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
    };

    try {
      const token = localStorage.getItem('token');
      resetIdleTimer();
      const res = await fetch(`${api.defaults.baseURL}/courses/${courseId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'Something went wrong asking the tutor.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop();

        for (const frame of frames) {
          if (!frame.startsWith('data: ')) continue;
          const raw = frame.slice(6);
          if (!raw) continue;

          let payload;
          try {
            payload = JSON.parse(raw);
          } catch {
            continue; // skip a malformed/keep-alive frame instead of aborting the whole stream
          }

          if (payload.token) {
            appendToken(id, payload.token);
          } else if (payload.done) {
            finishMessage(id, { citedChunks: payload.citations || [] });
          } else if (payload.error) {
            finishMessage(id, { answer: payload.error, citedChunks: [] });
          }
        }
      }
    } catch (err) {
      const message =
        err.name === 'AbortError'
          ? 'The tutor took too long to respond. Please try again.'
          : err.message || 'Something went wrong asking the tutor.';
      finishMessage(id, { answer: message, citedChunks: [] });
    } finally {
      clearTimeout(idleTimer);
      setAsking(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col h-[520px]">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="font-semibold text-sm">AI Tutor</h3>
        <p className="text-xs text-slate-400">Answers are grounded only in this course's content</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loadingHistory ? (
          <p className="text-xs text-slate-400">Loading conversation...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-slate-400">
            Ask a question about this course and the tutor will answer using the lesson content.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m._id || m.id} className="space-y-1">
              <div className="bg-indigo-50 text-indigo-900 text-sm rounded-md px-3 py-2 ml-8">
                {m.question}
              </div>
              <div className="bg-slate-100 text-slate-800 text-sm rounded-md px-3 py-2 mr-8">
                {m.pending ? (
                  <span className="text-slate-400">Thinking...</span>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{m.answer}</p>
                    {m.citedChunks?.length > 0 && (
                      <details className="mt-2 text-xs text-slate-500">
                        <summary className="cursor-pointer">
                          Sources ({m.citedChunks.length})
                        </summary>
                        <ul className="mt-1 space-y-1 list-disc list-inside">
                          {m.citedChunks.map((c, ci) => (
                            <li key={ci}>
                              {c.source === 'attachment' && c.sourceLabel
                                ? `${c.sourceLabel} (attached to "${c.lessonTitle}")`
                                : c.lessonTitle}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleAsk} className="p-3 border-t border-slate-200 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this course..."
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={asking}
          className="bg-indigo-600 text-white text-sm rounded-md px-3 py-2 hover:bg-indigo-700 disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
