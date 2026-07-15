import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { filterPassportCountries } from '../utils/passportCountries.js'

export function PassportCountryCombobox({
  kind,
  value,
  onChange,
  onSelectCountry,
  placeholder = '-- Please Select --',
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const options = useMemo(() => filterPassportCountries(value), [value])
  const isCode = kind === 'code'

  function choose(option) {
    const nextValue = isCode ? option.code : option.nationality
    onChange(nextValue)
    onSelectCountry?.(option)
    setIsOpen(false)
  }

  function updateValue(nextValue) {
    onChange(isCode ? nextValue.toUpperCase() : nextValue)
    setIsOpen(true)
  }

  return (
    <div
      className="passport-country-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}
    >
      <div className="passport-country-input-wrap">
        <input
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && options[0]) {
              event.preventDefault()
              choose(options[0])
            }
            if (event.key === 'Escape') setIsOpen(false)
          }}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
        />
        <button
          type="button"
          aria-label="Show country options"
          onClick={() => setIsOpen((current) => !current)}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {isOpen && (
        <div className="passport-country-menu" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.code}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              role="option"
              aria-selected={value === (isCode ? option.code : option.nationality)}
            >
              <strong>{option.code}</strong>
              <span>{option.nationality}</span>
            </button>
          ))}
          {options.length === 0 && <div className="passport-country-empty">No country found</div>}
        </div>
      )}
    </div>
  )
}
