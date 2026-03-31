import { Badge } from '../ui/Badge';
import { VehicleDiagram } from '../vehicle/VehicleDiagram';
import { AskAI } from './AskAI';
import type { PmcsStepData, StepResult, VehicleType } from '../../types';

interface StepCardProps {
  step: PmcsStepData;
  stepResult: StepResult;
  vehicleType?: VehicleType;
}

export function StepCard({ step, vehicleType }: StepCardProps) {
  return (
    <div className="flex flex-col gap-3 px-4 overflow-y-auto flex-1">
      <VehicleDiagram
        vehicleType={vehicleType || 'M1151'}
        zone={step.zone}
        itemNumber={step.item}
        className="flex-shrink-0"
      />

      {/* Item header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <h2 className="text-lg font-bold font-display text-text-primary leading-tight">
            Item {step.item}: {step.itemDescription}
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {step.isNoGo && (
            <Badge variant="red">NO-GO ITEM</Badge>
          )}
          {step.conditionSet && step.conditionSet !== 'BEFORE' && (
            <Badge variant="blue">{step.conditionSet}</Badge>
          )}
        </div>
      </div>

      {/* Procedure */}
      <p className="text-base text-text-primary leading-relaxed">
        {step.procedure}
      </p>

      {/* NO-GO condition */}
      {step.isNoGo && step.noGoCondition && (
        <div className="bg-accent-red/10 border border-accent-red/20 rounded-[var(--radius-md)] p-3">
          <p className="text-sm text-accent-red font-medium">
            NO-GO if: {step.noGoCondition}
          </p>
        </div>
      )}

      {/* Ask AI */}
      <AskAI step={step} vehicleType={vehicleType || 'M1151'} />

      {/* TM Reference */}
      <p className="text-xs text-text-secondary/60 font-display">
        {step.conditionSet} — Item {step.item}
      </p>
    </div>
  );
}
