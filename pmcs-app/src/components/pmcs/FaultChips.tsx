import { FAULT_SUGGESTIONS } from '../../data/faultSuggestions';
import type { Readiness } from '../../types/diagnosis';

interface FaultChipsProps {
  stepId: string;
  onSelect: (text: string, categoryId: string, readiness?: Readiness) => void;
}

export function FaultChips({ stepId, onSelect }: FaultChipsProps) {
  const suggestions = FAULT_SUGGESTIONS[stepId];
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.text}
          type="button"
          onClick={() => onSelect(suggestion.text, suggestion.categoryId, suggestion.readiness)}
          className="px-3 py-1.5 min-h-[44px] text-sm text-text-secondary border border-border rounded-full active:bg-bg-tertiary active:text-text-primary transition-colors"
        >
          {suggestion.text}
        </button>
      ))}
    </div>
  );
}
