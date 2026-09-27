import { useState, useMemo, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export function SearchSelect<T>({
  options,
  value,
  onChange,
  onSelectFull,
  placeholder = "Select...",
  getDisplayValue,
  getSearchText,
  renderItem,
}: {
  options: T[];
  value: string;
  onChange: (v: string) => void;
  onSelectFull?: (item: T) => void;
  placeholder?: string;
  getDisplayValue: (item: T | undefined) => string;
  getSearchText: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return options;
    const lower = debouncedSearch.toLowerCase();
    return options.filter((o) => getSearchText(o).toLowerCase().includes(lower));
  }, [options, debouncedSearch, getSearchText]);

  // Try to find selected object using getDisplayValue, but that implies value is the display string,
  // or value is a unique key. We'll assume 'value' matches what getDisplayValue returns,
  // or you could pass a custom comparator.
  // Actually, we'll just let the caller pass the raw value string.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-start text-left font-normal truncate">
          {value || <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] sm:w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} />
          <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((o, i) => (
                <CommandItem
                  key={i}
                  value={getDisplayValue(o)}
                  onSelect={(v) => {
                    onChange(getDisplayValue(o));
                    onSelectFull?.(o);
                    setOpen(false);
                  }}
                >
                  {renderItem(o)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
