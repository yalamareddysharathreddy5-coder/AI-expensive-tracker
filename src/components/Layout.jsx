import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { FiMenu, FiMoon, FiSun } from 'react-icons/fi';
import Sidebar from './Sidebar';
import useExpenseContext from '../context/ExpenseContext';

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { settings, updateSettings } = useExpenseContext();
  const location = useLocation();

  const linkLabel = {
    '/': 'Dashboard',
    '/add': 'Add Expense',
    '/history': 'Expense History',
    '/budget': 'Budget',
    '/insights': 'AI Insights',
    '/reports': 'Reports',
    '/settings': 'Settings',
  };

  const pageName = linkLabel[location.pathname] || 'Expense Tracker';

  return (
    <div className="app">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="content">
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            <FiMenu />
          </button>
          <div className="topbar-title">{pageName}</div>

          <div className="topbar-right">
            <button
              className="theme-toggle"
              onClick={() => updateSettings({ darkMode: !settings.darkMode })}
              aria-label="Toggle theme"
              title="Toggle dark / light mode"
            >
              {settings.darkMode ? <FiSun /> : <FiMoon />}
            </button>
          </div>
        </header>

        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;