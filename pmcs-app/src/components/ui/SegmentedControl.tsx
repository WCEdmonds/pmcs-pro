interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  displayLabels?: Record<T, string>;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  displayLabels,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <div className="flex bg-bg-tertiary rounded-[var(--radius-md)] border border-border p-1 gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`
              flex-1 min-h-[44px] rounded-[var(--radius-sm)] text-base font-medium transition-colors
              ${value === opt
                ? 'bg-accent-blue text-white'
                : 'text-text-secondary active:bg-bg-secondary'
              }
            `}
          >
            {displayLabels?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}
