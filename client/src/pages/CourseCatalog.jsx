import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import CourseThumbnail from '../components/CourseThumbnail';
import EmptyState from '../components/EmptyState';
import { SearchIcon, SparklesIcon } from '../components/icons';

export default function CourseCatalog() {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const staleRef = useRef(false);

  useEffect(() => {
    api
      .get('/courses')
      .then((res) => {
        const unique = [...new Set(res.data.courses.map((c) => c.category).filter(Boolean))].sort();
        setCategories(unique);
      })
      .catch(() => {});
  }, []);

  // The debounce below already cancels a pending (not-yet-fired) request when
  // search/category changes again quickly, but once a request is actually in
  // flight a second one can still overtake it and resolve out of order —
  // staleRef guards against that response landing after a newer one already
  // has.
  useEffect(() => {
    staleRef.current = false;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError('');
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      api
        .get('/courses', { params })
        .then((res) => {
          if (!staleRef.current) setCourses(res.data.courses);
        })
        .catch(() => {
          if (!staleRef.current) setError('Could not load courses. Please try again.');
        })
        .finally(() => {
          if (!staleRef.current) setLoading(false);
        });
    }, 250);
    return () => {
      staleRef.current = true;
      clearTimeout(timeout);
    };
  }, [search, category]);

  return (
    <div>
      <div className="mb-6 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white px-6 py-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/15 rounded-full px-2.5 py-1">
          <SparklesIcon className="w-3.5 h-3.5" />
          AI tutor included on every course
        </span>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-3">Find your next skill</h1>
        <p className="text-indigo-100 mt-1 text-sm max-w-xl">
          Browse courses, track your progress, and ask an AI tutor grounded in the lesson
          content whenever you're stuck.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <div className="relative w-full max-w-md">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-transparent rounded-md pl-9 pr-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-white/60"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-transparent rounded-md px-3 py-2 text-sm bg-white text-slate-900"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse">
              <div className="h-32 w-full bg-slate-200 rounded-lg" />
              <div className="h-3 w-16 bg-slate-200 rounded mt-3" />
              <div className="h-5 w-3/4 bg-slate-200 rounded mt-3" />
              <div className="h-3 w-full bg-slate-100 rounded mt-3" />
              <div className="h-3 w-2/3 bg-slate-100 rounded mt-2" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="No courses found"
          message={
            search || category
              ? "Try a different search term or clear the category filter."
              : 'Check back soon — new courses are added regularly.'
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link
              key={course._id}
              to={`/courses/${course._id}`}
              className="block bg-white border border-slate-200 rounded-lg p-4 hover:shadow-lg hover:-translate-y-0.5 transition"
            >
              <CourseThumbnail course={course} />
              <span className="text-xs font-medium text-indigo-600 uppercase inline-block mt-3">
                {course.category}
              </span>
              <h2 className="font-semibold text-lg mt-1">{course.title}</h2>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{course.description}</p>
              <p className="text-xs text-slate-400 mt-3">By {course.tutor?.name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
