import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const DEFAULT_PROPS: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function LockIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
    </svg>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M19 12H5" />
      <path d="M11 18l-6-6 6-6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function LockFilledIcon(props: IconProps) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <circle cx="12" cy="15" r="1.5" fill="var(--color-on-brand, #fff)" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M16 13h3" />
    </svg>
  );
}

export function CoinsIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.66 2.69 3 6 3s6-1.34 6-3V7" />
      <path d="M9 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      <ellipse cx="15" cy="12" rx="6" ry="3" />
    </svg>
  );
}

export function GemIcon(props: IconProps) {
  return (
    <svg {...DEFAULT_PROPS} {...props}>
      <path d="M6 3h12l3 5-9 13L3 8z" />
      <path d="M3 8h18" />
      <path d="M9 3l-2 5 5 13 5-13-2-5" />
    </svg>
  );
}
