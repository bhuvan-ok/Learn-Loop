import { BookOpenIcon } from './icons';

// Most demo/seed courses have no thumbnailUrl, which otherwise leaves a flat
// blank rectangle on every card. Deriving a gradient from the course's own id
// gives every course a distinct, consistent-on-reload look with zero image
// assets to manage.
const GRADIENTS = [
  'from-indigo-500 to-purple-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
];

function gradientFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

export default function CourseThumbnail({ course, className = 'h-32' }) {
  if (course.thumbnailUrl) {
    return (
      <img
        src={course.thumbnailUrl}
        alt=""
        className={`w-full ${className} object-cover rounded-lg`}
      />
    );
  }

  const gradient = gradientFor(course._id || course.title || 'course');

  return (
    <div
      className={`w-full ${className} rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}
    >
      <BookOpenIcon className="w-16 h-16 text-white/30 absolute -right-2 -bottom-2" />
      <span className="text-white text-3xl font-bold relative">
        {(course.title || '?').trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
