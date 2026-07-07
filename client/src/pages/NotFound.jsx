import { Link } from 'react-router-dom';
import { CompassIcon } from '../components/icons';

export default function NotFound() {
  return (
    <div className="text-center py-20">
      <div className="mx-auto w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
        <CompassIcon className="w-8 h-8" />
      </div>
      <p className="text-5xl font-semibold text-indigo-600 mt-6">404</p>
      <h1 className="text-xl font-semibold mt-4">Page not found</h1>
      <p className="text-slate-500 mt-2">The page you're looking for doesn't exist or was moved.</p>
      <Link
        to="/"
        className="inline-block mt-6 bg-indigo-600 text-white rounded-md px-4 py-2 text-sm hover:bg-indigo-700"
      >
        Back to courses
      </Link>
    </div>
  );
}
