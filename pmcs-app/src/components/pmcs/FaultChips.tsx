import { FAULT_SUGGESTIONS } from '../../data/faultSuggestions';

interface FaultChipsProps {
  stepId: string;
  onSelect: (text: string, categoryId: string) => void;
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
          onClick={() => onSelect(suggestion.text, suggestion.categoryId)}
          className="px-3 py-1.5 min-h-[44px] text-sm text-text-secondary border border-border rounded-full active:bg-bg-tertiary active:text-text-primary transition-colors"
        >
          {suggestion.text}
        </button>
      ))}
    </div>
  );
}
