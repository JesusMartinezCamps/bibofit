import React from 'react';
import { normalizeText } from '@/lib/textSearch';

const HighlightedText = ({ text, highlight, className = 'bg-yellow-500/40 text-yellow-100 font-bold rounded px-0.5 shadow-[0_0_10px_rgba(234,179,8,0.2)]' }) => {
  if (!highlight || !text || !highlight.trim()) return text;

  const normalizedText = normalizeText(text);
  const normalizedHighlight = normalizeText(highlight);

  if (!normalizedText.includes(normalizedHighlight)) return text;

  // Safety fallback: avoid slicing mismatch if normalized length differs.
  if (normalizedText.length !== text.length) return text;

  const matchIndices = [];
  let startIndex = 0;
  let searchIndex = normalizedText.indexOf(normalizedHighlight, startIndex);

  while (searchIndex !== -1) {
    matchIndices.push({ start: searchIndex, end: searchIndex + normalizedHighlight.length });
    startIndex = searchIndex + normalizedHighlight.length;
    searchIndex = normalizedText.indexOf(normalizedHighlight, startIndex);
  }

  if (matchIndices.length === 0) return text;

  const result = [];
  let lastIndex = 0;

  matchIndices.forEach((match, i) => {
    if (match.start > lastIndex) {
      result.push(<span key={`text-${i}`}>{text.substring(lastIndex, match.start)}</span>);
    }
    result.push(
      <span key={`highlight-${i}`} className={className}>
        {text.substring(match.start, match.end)}
      </span>
    );
    lastIndex = match.end;
  });

  if (lastIndex < text.length) {
    result.push(<span key="text-end">{text.substring(lastIndex)}</span>);
  }

  return <>{result}</>;
};

export default HighlightedText;
