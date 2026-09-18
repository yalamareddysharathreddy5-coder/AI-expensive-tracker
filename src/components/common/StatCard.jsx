function StatCard({ icon, tone = '', label, value, hint }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon${tone ? ` ${tone}` : ''}`}>{icon}</div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

export default StatCard;