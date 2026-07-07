// Small hand-drawn icon set so the app doesn't need an external icon library
// dependency for a handful of recurring shapes.
function Icon({ children, className = 'w-5 h-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function BookOpenIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 6c-1.5-1.3-3.6-2-6.5-2S2 4.7 2 5.3v13c0 .5.4.7.8.5 1.4-.7 3.3-1.1 5.2-1.1 1.7 0 3.4.5 4 1.3" />
      <path d="M12 6c1.5-1.3 3.6-2 6.5-2s3.5 .7 3.5 1.3v13c0 .5-.4.7-.8.5-1.4-.7-3.3-1.1-5.2-1.1-1.7 0-3.4.5-4 1.3" />
      <path d="M12 6v13" />
    </Icon>
  );
}

export function UsersIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 19c.6-3 3-5 6.5-5s5.9 2 6.5 5" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14c2.6.3 4.3 1.9 4.8 4.3" />
    </Icon>
  );
}

export function TrophyIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 5H4.5A2.5 2.5 0 0 0 5 10H7" />
      <path d="M17 5h2.5A2.5 2.5 0 0 1 19 10h-2" />
      <path d="M10 13.5v2.5" />
      <path d="M14 13.5v2.5" />
      <path d="M8 20h8" />
      <path d="M9 20c0-1.7.6-3 3-3s3 1.3 3 3" />
    </Icon>
  );
}

export function ChatBubbleIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 5h16v11H8l-4 4z" />
    </Icon>
  );
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </Icon>
  );
}

export function SparklesIcon(props) {
  return (
    <Icon {...props}>
      <path d="M11 3v3M11 17v3M4 10H1M21 10h-3M18.5 3.5l-2 2M5.5 15.5l-2 2M18.5 17.5l-2-2M5.5 5.5l-2-2" />
      <path d="M11 6a5 5 0 0 0 5 5 5 5 0 0 0-5 5 5 5 0 0 0-5-5 5 5 0 0 0 5-5Z" />
    </Icon>
  );
}

export function CheckCircleIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3L16 10" />
    </Icon>
  );
}

export function ClipboardListIcon(props) {
  return (
    <Icon {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </Icon>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 12h16" />
      <path d="m13 5 7 7-7 7" />
    </Icon>
  );
}

export function LockIcon(props) {
  return (
    <Icon {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Icon>
  );
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CompassIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.8 9.2-1.6 4.4-4.4 1.6 1.6-4.4z" />
    </Icon>
  );
}
