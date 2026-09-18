import { CATEGORY_COLORS } from '../../data/constants';

function CategoryChip({ category }) {
  return (
    <span className="chip">
      <span
        className="chip-dot"
        style={{ background: CATEGORY_COLORS[category] || '#64748b' }}
      />
      {category}
    </span>
  );
}

export default CategoryChip;