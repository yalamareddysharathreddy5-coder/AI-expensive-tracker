import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ExpenseProvider } from './context/ExpenseContext';
import Dashboard from './pages/Dashboard';
import AddExpense from './pages/AddExpense';
import ExpenseHistory from './pages/ExpenseHistory';
import Budget from './pages/Budget';
import AIInsights from './pages/AIInsights';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  return (
    <ExpenseProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="add" element={<AddExpense />} />
            <Route path="history" element={<ExpenseHistory />} />
            <Route path="budget" element={<Budget />} />
            <Route path="insights" element={<AIInsights />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ExpenseProvider>
  );
}

export default App;