// Where a user lands right after logging in / registering, based on role.
export function roleHomePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'tutor') return '/tutor';
  return '/dashboard';
}
