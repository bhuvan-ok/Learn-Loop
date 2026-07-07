import { useEffect, useState, useCallback, useRef } from 'react';
import { listPosts, createPost, deletePost } from '../api/discussions';

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Post({ post, onReply, onDelete, isReply }) {
  return (
    <div className={isReply ? 'ml-8 mt-3' : 'border-b border-slate-100 pb-3'}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-800">
          {post.author?.name || 'Unknown'}
          {post.author?.role && post.author.role !== 'student' && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-indigo-500">
              {post.author.role}
            </span>
          )}
        </span>
        <span className="text-xs text-slate-400">{timeAgo(post.createdAt)}</span>
      </div>
      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{post.content}</p>
      <div className="flex gap-3 mt-1">
        {!isReply && (
          <button
            onClick={() => onReply(post._id)}
            className="text-xs text-indigo-600 hover:underline"
          >
            Reply
          </button>
        )}
        {post.canDelete && (
          <button
            onClick={() => onDelete(post._id)}
            className="text-xs text-red-500 hover:underline"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function LessonDiscussion({ courseId, lessonId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [actionError, setActionError] = useState('');
  const staleRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listPosts(courseId, lessonId);
      if (!staleRef.current) setPosts(res.data.posts);
    } catch (err) {
      if (!staleRef.current) setError(err.response?.data?.message || 'Could not load the discussion.');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newContent.trim() || submitting) return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await createPost(courseId, lessonId, { content: newContent.trim() });
      setPosts((prev) => [...prev, res.data.post]);
      setNewContent('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (e, parentId) => {
    e.preventDefault();
    if (!replyContent.trim() || submitting) return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await createPost(courseId, lessonId, {
        content: replyContent.trim(),
        parentPost: parentId,
      });
      setPosts((prev) => [...prev, res.data.post]);
      setReplyContent('');
      setReplyingTo(null);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not post your reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (postId) => {
    setActionError('');
    try {
      await deletePost(courseId, lessonId, postId);
      setPosts((prev) => prev.filter((p) => String(p._id) !== String(postId) && String(p.parentPost) !== String(postId)));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not delete this post. Please try again.');
    }
  };

  const topLevel = posts.filter((p) => !p.parentPost);
  const repliesFor = (parentId) => posts.filter((p) => String(p.parentPost) === String(parentId));

  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="font-semibold text-sm mb-3">Discussion</h3>

      {loading ? (
        <p className="text-xs text-slate-400">Loading discussion...</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <>
          {topLevel.length === 0 ? (
            <p className="text-xs text-slate-400 mb-3">
              No questions yet — be the first to ask something about this lesson.
            </p>
          ) : (
            <div className="space-y-3 mb-4">
              {topLevel.map((post) => (
                <div key={post._id}>
                  <Post post={post} onReply={setReplyingTo} onDelete={handleDelete} />
                  {repliesFor(post._id).map((reply) => (
                    <Post key={reply._id} post={reply} onDelete={handleDelete} isReply />
                  ))}
                  {replyingTo === post._id && (
                    <form
                      onSubmit={(e) => handleReplySubmit(e, post._id)}
                      className="ml-8 mt-2 flex gap-2"
                    >
                      <input
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="text-sm text-indigo-600 disabled:opacity-60"
                      >
                        Post
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {actionError && <p className="text-xs text-red-600 mb-2">{actionError}</p>}

          <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-slate-100">
            <input
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Ask a question or share something about this lesson..."
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 text-white text-sm rounded-md px-3 py-2 hover:bg-indigo-700 disabled:opacity-60"
            >
              Post
            </button>
          </form>
        </>
      )}
    </div>
  );
}
