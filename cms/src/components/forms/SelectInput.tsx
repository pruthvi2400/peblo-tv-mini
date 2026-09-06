import type { ChangeEvent } from 'react';

export interface SelectOption<T extends string> {
  value: T | '';
  label: string;
}

export interface SelectInputProps<T extends string> {
  id: string;
  value: T | '';
  onChange: (value: T | '') => void;
  options: ReadonlyArray<SelectOption<T>>;
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
}

export function SelectInput<T extends string>({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  describedBy,
}: SelectInputProps<T>) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-describedby={describedBy}
      className="form-input"
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value as T | '');
      }}
    >
      {placeholder && (
        <option value="">{placeholder}</option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}