import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  allOptionLabel?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  allOptionLabel = "All"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = React.useId();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const isAllSelected = value === allOptionLabel || value === 'All TL' || value === 'All BPO' || value === 'All Agents';

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          "flex items-center justify-between w-full bg-surface border border-border rounded-xl px-3 py-1.5 text-sm font-medium text-text-primary transition-colors cursor-pointer",
          "focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        )}
      >
        <span className="truncate">{isAllSelected ? allOptionLabel : value}</span>
        <ChevronDown className="w-4 h-4 text-text-muted ml-1 shrink-0" aria-hidden />
      </button>

      {isOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label={placeholder}
          className="absolute z-[9999] mt-1 w-full min-w-[14rem] bg-card border border-border rounded-xl shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-border flex items-center">
             <Search className="w-3.5 h-3.5 text-text-muted mr-2 shrink-0" aria-hidden />
             <input 
               type="text" 
               className="w-full text-sm border-none focus:outline-none focus-visible:ring-0 p-0 text-text-primary bg-transparent" 
               placeholder={placeholder} 
               value={search}
               autoFocus
               aria-label={placeholder}
               onChange={e => setSearch(e.target.value)}
             />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            <button 
              type="button"
              role="option"
              aria-selected={isAllSelected}
              className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${isAllSelected ? 'bg-primary-soft text-primary font-semibold' : 'text-text-primary hover:bg-surface-muted'}`}
              onClick={() => handleSelect(allOptionLabel)}
            >
              <span>{allOptionLabel}</span>
              {isAllSelected && <Check className="w-3.5 h-3.5 text-primary" aria-hidden />}
            </button>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => {
                const isSelected = opt === value;
                return (
                  <button 
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${isSelected ? 'bg-primary-soft text-primary font-semibold' : 'text-text-primary hover:bg-surface-muted'}`}
                    onClick={() => handleSelect(opt)}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />}
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-3 text-sm text-text-muted text-center">Tidak ada hasil</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
