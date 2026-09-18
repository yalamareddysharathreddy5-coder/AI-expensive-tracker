function ProgressBar({ value }) {
  let tone = 'green';
  if (value >= 100) tone = 'red';
  else if (value >= 80) tone = 'amber';

  return (
    <div className="progress">
      <div className={`progress-fill ${tone}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export default ProgressBar;