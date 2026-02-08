import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, SlidersHorizontal, X } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCountry: string;
  onCountryChange: (value: string) => void;
  countries: string[];
  minScore: number;
  onMinScoreChange: (value: number) => void;
  onClearFilters: () => void;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  selectedCountry,
  onCountryChange,
  countries,
  minScore,
  onMinScoreChange,
  onClearFilters,
}: FilterBarProps) {
  const hasActiveFilters = searchQuery || selectedCountry || minScore > 0;

  return (
    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card rounded-xl border shadow-card">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search hospitals by name or location..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={selectedCountry} onValueChange={onCountryChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Countries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Countries</SelectItem>
          {countries.map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={minScore.toString()} onValueChange={(v) => onMinScoreChange(parseInt(v))}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Min Score" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Any Score</SelectItem>
          <SelectItem value="3">Score ≥ 3</SelectItem>
          <SelectItem value="5">Score ≥ 5</SelectItem>
          <SelectItem value="7">Score ≥ 7</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearFilters}
          className="flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
