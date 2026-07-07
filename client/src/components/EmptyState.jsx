import { Link } from 'react-router-dom';

export default function EmptyState({ icon: IconComponent, title, message, actionTo, actionLabel }) {
  return (
    <div className="text-center py-14 px-6 bg-white border border-dashed border-slate-200 rounded-xl">
      {IconComponent && (
        <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
          <IconComponent className="w-6 h-6" />
        </div>
      )}
      <h3 className="mt-4 font-semibold text-slate-700">{title}</h3>
      {message && <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">{message}</p>}
      {actionTo && (
        <Link
          to={actionTo}
          className="inline-block mt-5 bg-indigo-600 text-white text-sm rounded-md px-4 py-2 hover:bg-indigo-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
