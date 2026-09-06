import type { ChangeEvent } from 'react';

export interface MultiSelectProps<T extends string> {
  id: string;
  /** Currently selected values. */
  value: T[];
  /** Available options. */
  options: ReadonlyArray<T>;
  /** Called with the new full set after a change. */
  onChange: (next: T[]) => void;
  disabled?: boolean;
  describedBy?: string;
  /** How to render each option in the checkbox list. */
  formatLabel?: (value: T) => string;
}

/**
 * Native checkbox-based multi-select. Avoids custom dropdowns and works
 * well for the ~15-category option list we have today.
 */
export function MultiSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled,
  describedBy,
  formatLabel,
}: MultiSelectProps<T>) {
  const selected = new Set(value);

  const toggle = (opt: T, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(opt);
    else next.delete(opt);
    onChange(options.filter((o) => next.has(o)));
  };

  return (
    <fieldset
      id={id}
      disabled={disabled}
      aria-describedby={describedBy}
      className="form-multiselect"
    >
      <legend className="visually-hidden">{id}</legend>
      {options.map((opt) => (
        <label key={opt} className="form-multiselect__option">
          <input
            type="checkbox"
            checked={selected.has(opt)}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              toggle(opt, e.target.checked)
            }
          />
          <span>{formatLabel ? formatLabel(opt) : opt}</span>
        </label>
      ))}
    </fieldset>
  );
}