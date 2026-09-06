import type { ChangeEvent } from 'react';

export interface NumberInputProps {
  id: string;
  value: number | '';
  onChange: (value: number | '') => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  describedBy?: string;
  placeholder?: string;
}

export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  describedBy,
  placeholder,
}: NumberInputProps) {
  return (
    <input
      id={id}
      type="number"
      value={value === '' ? '' : value}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      aria-describedby={describedBy}
      className="form-input"
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange('');
          return;
        }
        const n = Number(raw);
        onChange(Number.isFinite(n) ? n : '');
      }}
    />
  );
}