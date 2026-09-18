import { FiInbox } from 'react-icons/fi';

function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FiInbox />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export default EmptyState;