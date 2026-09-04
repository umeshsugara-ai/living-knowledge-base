export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "accent" | "good" | "warn";
}

export function StatCard({ icon, label, value, tone = "accent" }: StatCardProps): React.ReactElement {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-icon">{icon}</div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}
