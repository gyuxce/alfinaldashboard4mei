import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

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
  }, [wrapperRef]);

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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full bg-surface border border-border rounded-xl px-3 py-1.5 text-sm font-medium text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
      >
        <span className="truncate">{isAllSelected ? allOptionLabel : value}</span>
        <ChevronDown className="w-4 h-4 text-text-muted ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-[9999] mt-1 w-full min-w-[14rem] bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border flex items-center">
             <Search className="w-3.5 h-3.5 text-text-muted mr-2 shrink-0" />
             <input 
               type="text" 
               className="w-full text-sm border-none focus:outline-none focus:ring-0 p-0 text-text-primary bg-transparent" 
               placeholder={placeholder} 
               value={search}
               autoFocus
               onChange={e => setSearch(e.target.value)}
             />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            <button 
              className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors cursor-pointer ${isAllSelected ? 'bg-primary-soft text-primary font-semibold' : 'text-text-primary hover:bg-surface-muted'}`}
              onClick={() => handleSelect(allOptionLabel)}
            >
              <span>{allOptionLabel}</span>
              {isAllSelected && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => {
                const isSelected = opt === value;
                return (
                  <button 
                    key={opt}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors cursor-pointer ${isSelected ? 'bg-primary-soft text-primary font-semibold' : 'text-text-primary hover:bg-surface-muted'}`}
                    onClick={() => handleSelect(opt)}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-3 text-sm text-text-muted text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
