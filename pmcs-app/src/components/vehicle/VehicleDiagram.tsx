import { useState } from 'react';
import { Truck, X } from 'lucide-react';
import { getPmcsItemImage } from '../../data/pmcsImages';
import type { VehicleType } from '../../types';

interface VehicleDiagramProps {
  vehicleType: VehicleType;
  zone: string;
  itemNumber?: string;
  className?: string;
}

export function VehicleDiagram({ vehicleType, zone, itemNumber, className = '' }: VehicleDiagramProps) {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = itemNumber ? getPmcsItemImage(vehicleType, itemNumber) : undefined;

  if (!imageUrl) {
    // Placeholder tier
    return (
      <div
        className={`
          flex items-center justify-center
          bg-bg-tertiary rounded-[var(--radius-lg)]
          h-[160px] max-h-[200px]
          ${className}
        `}
        role="img"
        aria-label={`${vehicleType} — ${zone}`}
      >
        <div className="flex flex-col items-center gap-2 text-text-secondary/30">
          <Truck size={48} />
          <span className="text-xs font-display text-center px-4">{zone}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Thumbnail */}
      <button
        onClick={() => setExpanded(true)}
        className={`
          bg-bg-tertiary rounded-[var(--radius-lg)] overflow-hidden
          h-[200px] max-h-[200px] w-full
          ${className}
        `}
        aria-label={`View diagram for ${zone}, Item ${itemNumber}. Tap to expand.`}
      >
        <img
          src={imageUrl}
          alt={`TM diagram: ${zone}, Item ${itemNumber}`}
          className="w-full h-full object-contain bg-white"
        />
      </button>

      {/* Full-screen expanded view */}
      {expanded && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col" onClick={() => setExpanded(false)}>
          <div className="flex items-center justify-between h-11 px-4 bg-bg-primary border-b border-border flex-shrink-0">
            <span className="text-sm font-display text-text-primary">
              {zone} — Item {itemNumber}
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-accent-blue"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-2">
            <img
              src={imageUrl}
              alt={`TM diagram: ${zone}, Item ${itemNumber}`}
              className="max-w-full max-h-full object-contain"
              style={{ touchAction: 'pinch-zoom' }}
            />
          </div>
          <div className="text-center py-2 text-xs text-gray-400 bg-bg-primary flex-shrink-0">
            Ref: {
              vehicleType === 'LMTV_M1078' ? 'TM 9-2320-365-10' :
              vehicleType === 'M1101_TRAILER' ? 'TM 9-2330-392-14P' :
              vehicleType === 'MEP803A' ? 'TM 9-6115-642-10' :
              'TM 9-2320-387-10'
            }
          </div>
        </div>
      )}
    </>
  );
}
