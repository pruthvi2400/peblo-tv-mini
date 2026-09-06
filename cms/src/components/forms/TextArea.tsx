import type { ChangeEvent } from 'react';

export interface TextAreaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
}

export function TextArea({
  id,
  value,
  onChange,
  rows = 4,
  placeholder,
  disabled,
  describedBy,
}: TextAreaProps) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      aria-describedby={describedBy}
      className="form-input"
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
    />
  );
}