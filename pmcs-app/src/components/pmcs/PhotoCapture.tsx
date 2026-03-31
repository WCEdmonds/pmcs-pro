import { useRef } from 'react';
import { Camera, X } from 'lucide-react';

interface PhotoCaptureProps {
  photos: string[];
  onCapture: (dataUrl: string) => void;
  onRemove: (index: number) => void;
}

export function PhotoCapture({ photos, onCapture, onRemove }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onCapture(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-[var(--radius-md)] overflow-hidden border border-border">
              <img src={photo} alt={`Fault photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(i)}
                className="absolute -top-2 -right-2 bg-accent-red rounded-full w-7 h-7 flex items-center justify-center"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 min-h-[44px] text-accent-blue text-sm font-medium"
      >
        <Camera size={18} />
        Add Photo
      </button>
    </div>
  );
}
