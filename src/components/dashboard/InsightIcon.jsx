import {
  FiTrendingUp,
  FiTrendingDown,
  FiCalendar,
  FiAward,
  FiClock,
  FiDollarSign,
  FiAlertTriangle,
} from 'react-icons/fi';

function InsightIcon({ icon }) {
  if (typeof icon === 'string' && icon.startsWith('#')) {
    return <span className="chip-dot" style={{ background: icon }} />;
  }

  switch (icon) {
    case 'trend-up':
      return <FiTrendingUp />;
    case 'trend-down':
      return <FiTrendingDown />;
    case 'weekend':
      return <FiCalendar />;
    case 'flag':
      return <FiAward />;
    case 'clock':
      return <FiClock />;
    case 'piggy':
      return <FiDollarSign />;
    default:
      return <FiAlertTriangle />;
  }
}

export default InsightIcon;