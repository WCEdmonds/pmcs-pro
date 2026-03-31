interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full min-h-[48px] px-0 gap-3 disabled:opacity-50"
    >
      <span className="text-base text-text-primary">{label}</span>
      <div
        className={`
          relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0
          ${checked ? 'bg-accent-green' : 'bg-bg-tertiary border border-border'}
        `}
      >
        <div
          className={`
            absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
          `}
        />
      </div>
    </button>
  );
}
