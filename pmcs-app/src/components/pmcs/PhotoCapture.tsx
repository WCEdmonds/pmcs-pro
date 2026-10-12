import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { compressImage } from '../../utils/photo';

interface PhotoCaptureProps {
  photos: string[];
  onCapture: (dataUrl: string) => void;
  onRemove: (index: number) => void;
}

export function PhotoCapture({ photos, onCapture, onRemove }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onCapture(await compressImage(file));
    } catch {
      setError('Could not add that photo');
    } finally {
      setBusy(false);
    }
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
        aria-label="Add photo"
      />
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 pt-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-[var(--radius-md)] border border-border">
              <img src={photo} alt={`Fault photo ${i + 1}`} className="w-full h-full object-cover rounded-[var(--radius-md)]" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove photo ${i + 1}`}
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
        disabled={busy}
        className="flex items-center gap-2 min-h-[44px] text-accent-blue text-sm font-medium disabled:opacity-50"
      >
        <Camera size={18} />
        {busy ? 'Processing photo…' : 'Add Photo'}
      </button>
      {error && <p className="text-sm text-accent-red">{error}</p>}
    </div>
  );
}
