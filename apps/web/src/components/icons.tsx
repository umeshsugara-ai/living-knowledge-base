/**
 * apps/web/src/components/icons.tsx — a small, hand-written icon set (no icon library
 * dependency added — a dozen simple 20x20 stroke SVGs cover every nav item and stat card this
 * app needs; pulling in a whole icon package for that would be the kind of premature dependency
 * this repo avoids elsewhere, e.g. the hand-rolled CORS middleware instead of the `cors` pkg).
 */
type IconProps = { className?: string };

function Svg({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>;
}
export function SessionsIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><path d="M4 5h16M4 12h16M4 19h10" /></Svg>;
}
export function BrainIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="12" cy="14" r="2.6" /><circle cx="5" cy="17" r="2" /><path d="M7.6 7.2 10.4 12.3M16.4 7.2 13.6 12.3M9.6 15.6 6.7 16.5" /></Svg>;
}
export function CalendarIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" /></Svg>;
}
export function SourcesIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /></Svg>;
}
export function IngestIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" /></Svg>;
}
export function MeetingBotIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><rect x="4" y="7" width="16" height="11" rx="2" /><path d="M9 3.5h6M12 3.5V7" /><circle cx="9" cy="12.5" r="1" fill="currentColor" /><circle cx="15" cy="12.5" r="1" fill="currentColor" /></Svg>;
}
export function WhatsAppIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><path d="M4.5 19.5 5.7 15.6A8 8 0 1 1 8.9 18.4Z" /><path d="M9 9.7c0-.6.5-1 1-1h.6c.3 0 .6.2.7.5l.5 1.4c.1.3 0 .6-.2.8l-.6.6c.5 1 1.3 1.8 2.3 2.3l.6-.6c.2-.2.5-.3.8-.2l1.4.5c.3.1.5.4.5.7v.6c0 .5-.4 1-1 1-3 0-6.6-2.6-6.6-6.6Z" fill="currentColor" stroke="none" /></Svg>;
}
export function SettingsIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>;
}
export function KeyIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M17 5l2 2M14 8l2 2" /></Svg>;
}
export function GapIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><path d="M12 9v4M12 16.5v.01" /><circle cx="12" cy="12" r="9" /></Svg>;
}
export function ExternalLinkIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><path d="M14 4h6v6" /><path d="M10 14 20 4" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></Svg>;
}
export function DocsIcon(props: IconProps): React.ReactElement {
  return <Svg {...props}><path d="M7 3h10v18H7z" /><path d="M10 8h4M10 12h4M10 16h2" /></Svg>;
}
