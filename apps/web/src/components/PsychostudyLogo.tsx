interface PsychostudyLogoProps {
  size?: number;
  className?: string;
}

export function PsychostudyLogo({
  size = 48,
  className,
}: PsychostudyLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Graduation cap */}
      <polygon
        points="60,8 20,24 60,40 100,24"
        fill="currentColor"
        opacity="0.9"
      />
      <rect x="57" y="24" width="6" height="14" rx="1" fill="currentColor" />
      <line
        x1="93"
        y1="26"
        x2="93"
        y2="40"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="93" cy="42" r="2.5" fill="currentColor" />

      {/* Shield */}
      <path
        d="M60,36 C60,36 24,42 24,42 L24,72 C24,88 40,102 60,112 C80,102 96,88 96,72 L96,42 C96,42 60,36 60,36Z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Brain — left hemisphere */}
      <path
        d="M47,60 C42,58 40,62 41,66 C39,66 37,69 39,72 C38,74 39,78 42,79 C42,82 44,84 47,84 C49,86 52,86 55,84 C57,83 58,81 58,78 L58,62 C56,58 51,57 47,60Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Brain — right hemisphere */}
      <path
        d="M73,60 C78,58 80,62 79,66 C81,66 83,69 81,72 C82,74 81,78 78,79 C78,82 76,84 73,84 C71,86 68,86 65,84 C63,83 62,81 62,78 L62,62 C64,58 69,57 73,60Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Brain stem */}
      <path
        d="M58,82 Q60,90 62,82"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Brain folds — left */}
      <path
        d="M48,65 Q52,68 48,72"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M44,70 Q48,74 44,78"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Brain folds — right */}
      <path
        d="M72,65 Q68,68 72,72"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M76,70 Q72,74 76,78"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
