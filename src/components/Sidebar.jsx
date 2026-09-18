import { NavLink } from 'react-router-dom';
import {
  FiHome,
  FiPlusCircle,
  FiList,
  FiPieChart,
  FiCpu,
  FiBarChart2,
  FiSettings,
} from 'react-icons/fi';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: FiHome },
  { path: '/add', label: 'Add Expense', icon: FiPlusCircle },
  { path: '/history', label: 'Expense History', icon: FiList },
  { path: '/budget', label: 'Budget', icon: FiPieChart },
  { path: '/insights', label: 'AI Insights', icon: FiCpu },
  { path: '/reports', label: 'Reports', icon: FiBarChart2 },
  { path: '/settings', label: 'Settings', icon: FiSettings },
];

function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">₹</div>
          <div>
            <div className="brand-name">Expense Tracker</div>
            <div className="brand-sub">AI Insights Dashboard</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={onClose}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">College Mini Project · v1.0</div>
      </aside>
    </>
  );
}

export default Sidebar;