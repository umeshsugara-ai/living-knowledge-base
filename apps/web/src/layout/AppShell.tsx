import type { ReactNode } from "react";
import { NavSidebar } from "./NavSidebar.js";

export function AppShell({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <div className="app-shell">
      <NavSidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
