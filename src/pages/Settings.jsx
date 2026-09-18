import { FiMoon, FiSun, FiRefreshCw } from 'react-icons/fi';
import { CURRENCIES } from '../data/constants';
import useExpenseContext from '../context/ExpenseContext';

const NOTIFICATION_OPTIONS = [
  { key: 'expenseAdded', label: 'Expense added', desc: 'Show a confirmation when a new expense is saved.' },
  { key: 'budgetWarning', label: 'Budget warnings', desc: 'Remind me when I am close to exceeding a budget.' },
  { key: 'weeklySummary', label: 'Weekly summary', desc: 'Send a summary of my weekly spending.' },
];

function Settings() {
  const { settings, updateSettings, resetSampleData } = useExpenseContext();

  function handleReset() {
    if (window.confirm('Replace current data with the original sample data?')) {
      resetSampleData();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Personalize your expense tracker</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="settings-group-title">Profile</div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Display name</div>
                <div className="setting-desc">Shown on the dashboard</div>
              </div>
              <input
                className="form-input"
                style={{ maxWidth: 220 }}
                type="text"
                placeholder="Your name"
                value={settings.name}
                onChange={(e) => updateSettings({ name: e.target.value })}
              />
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Email</div>
                <div className="setting-desc">Used for future notifications</div>
              </div>
              <input
                className="form-input"
                style={{ maxWidth: 220 }}
                type="email"
                placeholder="you@example.com"
                value={settings.email}
                onChange={(e) => updateSettings({ email: e.target.value })}
              />
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Monthly income</div>
                <div className="setting-desc">Used for balance and savings</div>
              </div>
              <input
                className="form-input"
                style={{ maxWidth: 160 }}
                type="number"
                min="0"
                value={settings.income}
                onChange={(e) => updateSettings({ income: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="settings-group-title">Appearance</div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Dark mode</div>
                <div className="setting-desc">Switch between light and dark theme</div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(e) => updateSettings({ darkMode: e.target.checked })}
                />
                <span className="switch-slider" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Theme preview</div>
                <div className="setting-desc">Current theme: {settings.darkMode ? 'Dark' : 'Light'}</div>
              </div>
              {settings.darkMode ? <FiMoon /> : <FiSun />}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="settings-group-title">Currency</div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Currency symbol</div>
                <div className="setting-desc">Applies to all amounts</div>
              </div>
              <div className="currency-pills">
                {CURRENCIES.map((currency) => (
                  <button
                    key={currency}
                    className={`currency-pill${settings.currency === currency ? ' active' : ''}`}
                    onClick={() => updateSettings({ currency })}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="settings-group-title">Notifications</div>
            {NOTIFICATION_OPTIONS.map((option) => (
              <div className="setting-row" key={option.key}>
                <div className="setting-info">
                  <div className="setting-label">{option.label}</div>
                  <div className="setting-desc">{option.desc}</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.notifications[option.key]}
                    onChange={(e) =>
                      updateSettings({
                        notifications: {
                          ...settings.notifications,
                          [option.key]: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className="switch-slider" />
                </label>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="settings-group-title">Data</div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Reset sample data</div>
                <div className="setting-desc">Restore the demo expenses that ship with the app</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={handleReset}>
                <FiRefreshCw /> Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;