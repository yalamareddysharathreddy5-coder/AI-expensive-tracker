import { CATEGORIES } from '../data/constants';

export const CATEGORY_KEYWORDS = {
  Food: [
    ['food', 1],
    ['restaurant', 2],
    ['lunch', 1],
    ['dinner', 1],
    ['breakfast', 1],
    ['pizza', 2],
    ['burger', 1],
    ['biryani', 2],
    ['coffee', 1],
    ['cafe', 1],
    ['snacks', 1],
    ['grocery', 2],
    ['groceries', 2],
    ['supermarket', 2],
    ['swiggy', 2],
    ['zomato', 2],
    ['dominos', 2],
    ['kfc', 2],
    ['mcdonalds', 2],
  ],
  Transportation: [
    ['uber', 2],
    ['ola', 2],
    ['rapido', 2],
    ['taxi', 2],
    ['cab', 1],
    ['bus', 1],
    ['metro', 2],
    ['train', 1],
    ['auto', 1],
    ['fuel', 2],
    ['petrol', 2],
    ['diesel', 2],
    ['parking', 1],
    ['transportation', 1],
  ],
  Shopping: [
    ['amazon', 2],
    ['flipkart', 2],
    ['myntra', 2],
    ['clothing', 1],
    ['clothes', 1],
    ['shoes', 1],
    ['shirt', 1],
    ['electronics', 1],
    ['headphones', 2],
    ['phone', 1],
    ['laptop', 2],
    ['shopping', 1],
  ],
  Bills: [
    ['electricity', 2],
    ['water bill', 2],
    ['internet', 2],
    ['wifi', 2],
    ['broadband', 2],
    ['mobile recharge', 2],
    ['phone bill', 2],
    ['rent', 2],
    ['gas bill', 2],
    ['bill', 1],
  ],
  Entertainment: [
    ['movie', 1],
    ['cinema', 2],
    ['netflix', 2],
    ['spotify', 2],
    ['youtube', 2],
    ['game', 1],
    ['gaming', 2],
    ['concert', 2],
    ['ott', 2],
    ['entertainment', 1],
  ],
  Education: [
    ['course', 1],
    ['udemy', 2],
    ['coursera', 2],
    ['book', 1],
    ['textbook', 2],
    ['college', 1],
    ['tuition', 2],
    ['exam', 1],
    ['education', 1],
    ['training', 1],
    ['certification', 2],
    ['learning', 1],
  ],
  Healthcare: [
    ['doctor', 2],
    ['hospital', 2],
    ['medicine', 2],
    ['pharmacy', 2],
    ['medical', 2],
    ['dentist', 2],
    ['healthcare', 1],
    ['clinic', 2],
    ['treatment', 1],
    ['health', 1],
  ],
  Travel: [
    ['flight', 2],
    ['hotel', 2],
    ['trip', 1],
    ['vacation', 2],
    ['tourism', 2],
    ['travel', 1],
    ['booking', 1],
    ['resort', 2],
    ['train ticket', 2],
    ['airport', 2],
  ],
};

const NO_MATCH_CATEGORY = 'Other';
const MAX_TEXT_LENGTH = 1000;

export function normalizeDescription(value) {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function hasWord(text, keyword) {
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

export function scoreDescription(text) {
  const normalized = normalizeDescription(text);
  if (normalized.length === 0) {
    return { scores: {}, totalPoints: 0, matchedByCategory: {} };
  }

  const scores = {};
  const matchedByCategory = {};
  let totalPoints = 0;

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    let points = 0;
    const matched = [];
    keywords.forEach(([keyword, weight]) => {
      if (hasWord(normalized, keyword)) {
        points += weight;
        matched.push(keyword);
      }
    });
    if (points > 0) {
      scores[category] = points;
      matchedByCategory[category] = matched;
      totalPoints += points;
    }
  });

  return { scores, totalPoints, matchedByCategory, categoryOrder: CATEGORIES };
}

export function suggestCategory(description) {
  const normalized = normalizeDescription(description);
  if (normalized.length === 0) {
    return null;
  }

  const { scores, totalPoints, matchedByCategory, categoryOrder } =
    scoreDescription(description);

  if (totalPoints <= 0) {
    return {
      category: NO_MATCH_CATEGORY,
      confidence: 0.2,
      matchedKeywords: [],
      reason: 'No strong keyword match found.',
    };
  }

  const ranked = Object.entries(scores)
    .map(([category, points]) => ({ category, points }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aMax = Math.max(...matchedByCategory[a.category].map((k) => getWeight(a.category, k)));
      const bMax = Math.max(...matchedByCategory[b.category].map((k) => getWeight(b.category, k)));
      if (bMax !== aMax) return bMax - aMax;
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    });

  const top = ranked[0];
  const bestPoints = top.points;
  const share = bestPoints / totalPoints;
  const strongFactor = Math.min(1, bestPoints / 4);
  const confidence = Math.min(
    0.99,
    Math.max(0.3, Math.round((0.65 * share + 0.35 * strongFactor) * 100) / 100)
  );

  const matchedKeywords = matchedByCategory[top.category];
  const reason = `Matched keyword${matchedKeywords.length === 1 ? '' : 's'}: ${matchedKeywords.join(', ')}`;

  return {
    category: top.category,
    confidence,
    matchedKeywords,
    reason,
  };
}

function getWeight(category, keyword) {
  const entry = CATEGORY_KEYWORDS[category].find(([k]) => k === keyword);
  return entry ? entry[1] : 1;
}