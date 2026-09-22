import {
  FiTrendingUp,
  FiTrendingDown,
  FiCalendar,
  FiAward,
  FiClock,
  FiDollarSign,
  FiAlertTriangle,
  FiCreditCard,
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
    case 'calendar':
      return <FiCalendar />;
    case 'flag':
      return <FiAward />;
    case 'clock':
      return <FiClock />;
    case 'piggy':
      return <FiDollarSign />;
    case 'credit-card':
      return <FiCreditCard />;
    default:
      return <FiAlertTriangle />;
  }
}

export default InsightIcon;