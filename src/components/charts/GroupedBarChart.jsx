function GroupedBarChart({ data }) {
  const incomes = data.map((d) => d.income);
  const expenses = data.map((d) => d.expense);
  const max = Math.max(...incomes, ...expenses, 1);

  function height(value) {
    return `${Math.max((value / max) * 100, 2)}%`;
  }

  return (
    <div>
      <div className="grouped-chart">
        {data.map((d, index) => (
          <div className="group-col" key={d.key || index}>
            <div className="group-bars">
              <div className="group-bar income" style={{ height: height(d.income) }} />
              <div className="group-bar expense" style={{ height: height(d.expense) }} />
            </div>
            <div className="bar-label">{d.label}</div>
          </div>
        ))}
      </div>
      <div className="group-legend">
        <span>
          <i style={{ background: 'var(--green)' }} /> Income
        </span>
        <span>
          <i style={{ background: 'var(--red)' }} /> Expenses
        </span>
      </div>
    </div>
  );
}

export default GroupedBarChart;