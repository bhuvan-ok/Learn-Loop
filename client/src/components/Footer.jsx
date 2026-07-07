import { BookOpenIcon } from './icons';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <p className="flex items-center gap-1.5">
          <BookOpenIcon className="w-3.5 h-3.5" />
          &copy; {new Date().getFullYear()} LearnLoop. All rights reserved.
        </p>
        <p>Courses, quizzes, and an AI tutor grounded in your course content.</p>
      </div>
    </footer>
  );
}
