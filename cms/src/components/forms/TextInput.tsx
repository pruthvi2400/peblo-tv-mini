import type { ChangeEvent } from 'react';

export interface TextInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'url';
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
  /** Max input length (HTML `maxLength`). */
  maxLength?: number;
  /** ID of an element that describes this input (e.g. error message). */
  describedBy?: string;
}

export function TextInput({
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  readOnly,
  autoComplete,
  maxLength,
  describedBy,
}: TextInputProps) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      autoComplete={autoComplete}
      maxLength={maxLength}
      aria-describedby={describedBy}
      className="form-input"
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}