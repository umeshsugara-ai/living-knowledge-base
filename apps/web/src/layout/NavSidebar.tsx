import { NavLink } from "react-router-dom";

// apps/api serves /compete and /docs-ui itself, not apps/web -- in dev these run on different
// ports (apps/web on Vite's 5173, apps/api on 3300+), so a bare relative href would 404 against
// the wrong origin. Same VITE_API_BASE_URL apps/web's fetch client uses (empty string = same
// origin, correct for the production/Docker case where both are behind one reverse proxy).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

interface NavItem {
  to: string;
  label: string;
  external?: boolean;
}

// Only pages that exist today link internally; Compete stays a link-out to the already-working,
// checker-PASSed server-rendered page rather than being reimplemented here (plan §8b non-goals).
const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/sessions", label: "Sessions" },
  { to: "/brain", label: "Brain" },
  { to: "/calendar", label: "Calendar" },
  { to: "/sources", label: "Sources" },
  { to: "/settings", label: "Settings" },
];

export function NavSidebar(): React.ReactElement {
  return (
    <nav className="nav-sidebar">
      <div className="brand">Vidysea &middot; LKB</div>
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
          {item.label}
        </NavLink>
      ))}
      <a href={`${API_BASE_URL}/compete`}>Compete</a>
      <a href={`${API_BASE_URL}/docs-ui`}>API Docs</a>
    </nav>
  );
}
