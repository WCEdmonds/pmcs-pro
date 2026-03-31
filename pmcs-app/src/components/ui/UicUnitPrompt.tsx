import { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';

interface UicUnitPromptProps {
  uic: string;
  open: boolean;
  onSave: (unitName: string) => void;
  onCancel: () => void;
}

export function UicUnitPrompt({ uic, open, onSave, onCancel }: UicUnitPromptProps) {
  const [unitName, setUnitName] = useState('');

  return (
    <Modal open={open} onClose={onCancel} title="New UIC">
      <p className="text-text-secondary text-sm mb-4">
        First time using <span className="font-display font-bold text-text-primary">{uic}</span>. What unit does this UIC belong to?
      </p>
      <Input
        label="Unit / Organization Name"
        value={unitName}
        onChange={(e) => setUnitName(e.target.value)}
        placeholder="e.g., A CO, 1-64 AR"
        autoFocus
      />
      <div className="flex gap-3 mt-4">
        <Button variant="secondary" fullWidth onClick={onCancel}>Skip</Button>
        <Button fullWidth onClick={() => onSave(unitName.trim())} disabled={!unitName.trim()}>Save</Button>
      </div>
    </Modal>
  );
}
