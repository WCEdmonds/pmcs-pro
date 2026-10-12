import {
  ArrowDownUp, ArrowUpFromLine, Battery, BatteryWarning, Bolt, Cable, CircleDot, CircleHelp, CircleX, Cloud, Cog,
  Construction, Cylinder, Disc, Droplet, Droplets, Ellipsis, Eye, Fan, FireExtinguisher, Flame, Fuel, Gauge, Hammer,
  Lightbulb, Link, Lock, OctagonAlert, PackageX, Plug, PowerOff, Radio, Ruler, Scan, Shield, ShieldAlert, Siren,
  Snowflake, Tag, Thermometer, TriangleAlert, Unplug, VolumeX, Wind, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';
import type { FaultCategory } from '../../types/diagnosis';
import { getCategoriesForStep, FAULT_CATEGORIES } from '../../data/faultCategories';

// Explicit map so only these icons are bundled (a namespace import pulls in all of lucide).
const ICONS: Record<string, LucideIcon> = {
  'arrow-down-up': ArrowDownUp,
  'arrow-up-from-line': ArrowUpFromLine,
  battery: Battery,
  'battery-warning': BatteryWarning,
  bolt: Bolt,
  cable: Cable,
  'circle-dot': CircleDot,
  'circle-x': CircleX,
  cloud: Cloud,
  cog: Cog,
  construction: Construction,
  cylinder: Cylinder,
  disc: Disc,
  droplet: Droplet,
  droplets: Droplets,
  eye: Eye,
  fan: Fan,
  'fire-extinguisher': FireExtinguisher,
  flame: Flame,
  fuel: Fuel,
  gauge: Gauge,
  hammer: Hammer,
  lightbulb: Lightbulb,
  link: Link,
  lock: Lock,
  'octagon-alert': OctagonAlert,
  'package-x': PackageX,
  plug: Plug,
  'power-off': PowerOff,
  radio: Radio,
  ruler: Ruler,
  scan: Scan,
  shield: Shield,
  'shield-alert': ShieldAlert,
  siren: Siren,
  snowflake: Snowflake,
  tag: Tag,
  thermometer: Thermometer,
  'triangle-alert': TriangleAlert,
  'alert-triangle': TriangleAlert,
  unplug: Unplug,
  'volume-x': VolumeX,
  wind: Wind,
  wrench: Wrench,
  zap: Zap,
};

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
          const IconComponent = ICONS[cat.icon] ?? CircleHelp;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat)}
              className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-border text-left min-h-[48px] active:border-accent-blue active:bg-bg-tertiary transition-colors"
            >
              <IconComponent size={20} className="text-text-secondary flex-shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-text-primary">{cat.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOther}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-border text-left min-h-[48px] active:border-accent-blue active:bg-bg-tertiary transition-colors"
        >
          <Ellipsis size={20} className="text-text-secondary flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-text-primary">Other</span>
        </button>
      </div>
    </div>
  );
}
