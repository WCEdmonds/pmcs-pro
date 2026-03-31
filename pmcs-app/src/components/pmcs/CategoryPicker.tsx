import * as icons from 'lucide-react';
import type { FaultCategory } from '../../types/diagnosis';
import { getCategoriesForStep, FAULT_CATEGORIES } from '../../data/faultCategories';

interface CategoryPickerProps {
  stepId: string;
  onSelect: (category: FaultCategory) => void;
  onOther: () => void;
}

export function CategoryPicker({ stepId, onSelect, onOther }: CategoryPickerProps) {
  const stepCategories = getCategoriesForStep(stepId);
  const categories = stepCategories.length > 0 ? stepCategories : FAULT_CATEGORIES;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-bold font-display text-text-primary">What's the problem?</h3>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat) => {
          // Convert kebab-case icon name to PascalCase for lucide-react lookup
          const iconName = cat.icon
            .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
            .replace(/^(.)/, (_, c: string) => c.toUpperCase());
          const IconComponent =
            (icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[iconName] ||
            icons.HelpCircle;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat)}
              className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-border text-left min-h-[48px] active:border-accent-blue active:bg-bg-tertiary transition-colors"
            >
              <IconComponent size={20} className="text-text-secondary flex-shrink-0" />
              <span className="text-sm font-medium text-text-primary">{cat.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOther}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-border text-left min-h-[48px] active:border-accent-blue active:bg-bg-tertiary transition-colors"
        >
          <icons.MoreHorizontal size={20} className="text-text-secondary flex-shrink-0" />
          <span className="text-sm font-medium text-text-primary">Other</span>
        </button>
      </div>
    </div>
  );
}
