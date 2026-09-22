import { FiZap, FiCheckCircle, FiArrowRight } from 'react-icons/fi';

function confidenceLabel(confidence) {
  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.6) return 'Medium';
  if (confidence >= 0.3) return 'Low';
  return 'Very low';
}

function CategorySuggestion({ suggestion, selectedCategory, onAccept }) {
  if (!suggestion || suggestion.category === 'Other') return null;

  const matches = suggestion.category === selectedCategory;

  return (
    <div className={`category-suggestion${matches ? ' is-match' : ''}`}>
      <div className="suggestion-icon">
        <FiZap />
      </div>
      <div className="suggestion-info">
        {matches ? (
          <span className="suggestion-match">
            <FiCheckCircle /> Category matches AI suggestion
          </span>
        ) : (
          <>
            <div className="suggestion-text">
              AI suggests: <strong>{suggestion.category}</strong>
              <span className="suggestion-conf">
                {confidenceLabel(suggestion.confidence)} confidence
              </span>
            </div>
            <div className="suggestion-reason">{suggestion.reason}</div>
          </>
        )}
      </div>
      {!matches && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onAccept}>
          Use suggestion <FiArrowRight />
        </button>
      )}
    </div>
  );
}

export default CategorySuggestion;