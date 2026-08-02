import { useState, type KeyboardEvent } from 'react';
import { useSymbolSearch } from '../../app/queries';
import { upsertInstrument } from '../../app/instrumentActions';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { Instrument } from '../../domain/types';

const DEBOUNCE_MS = 300;

// A stable reference — `data: results = []` would create a new array every
// render while the query has no data, defeating the `results !== prevResults`
// change-check below and causing an infinite render loop.
const EMPTY_RESULTS: Instrument[] = [];

interface SymbolSearchProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (instrument: Instrument) => void;
}

export function SymbolSearch({ id, value, onChange, onSelect }: SymbolSearchProps) {
  const debouncedQuery = useDebouncedValue(value, DEBOUNCE_MS);
  const { data: results = EMPTY_RESULTS } = useSymbolSearch(debouncedQuery);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dismissed, setDismissed] = useState(false);

  // Reset selection/dismissal whenever the result set changes, without an
  // effect: adjusting state during render (React's documented pattern) keeps
  // this a pure derivation instead of a setState-in-effect cascade.
  const [prevResults, setPrevResults] = useState(results);
  if (results !== prevResults) {
    setPrevResults(results);
    setActiveIndex(-1);
    setDismissed(false);
  }

  const isOpen = results.length > 0 && !dismissed;
  const listboxId = `${id}-listbox`;

  function selectResult(instrument: Instrument) {
    void upsertInstrument(instrument);
    onChange(instrument.id);
    onSelect(instrument);
    setDismissed(true);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setDismissed(true);
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setDismissed(false);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setDismissed(false)}
        placeholder="Search symbol, e.g. BHP"
        autoComplete="off"
        className="w-full rounded-md border border-hairline bg-white px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-hairline bg-white text-sm shadow-md"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectResult(r);
              }}
              className={`cursor-pointer px-3 py-2 ${i === activeIndex ? 'bg-paper' : ''}`}
            >
              {r.name} <span className="text-muted">{r.exchange}/{r.currency}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
