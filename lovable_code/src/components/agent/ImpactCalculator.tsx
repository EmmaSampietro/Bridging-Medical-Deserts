import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useGhanaData } from '@/hooks/useGhanaData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calculator, TrendingUp, Users, DollarSign, GripVertical, X, Plus } from 'lucide-react';

// Investment categories with cost/impact models
const INVESTMENT_CATEGORIES = [
  { id: 'equipment', label: 'Medical Equipment', costPerUnit: 50000, impactPerUnit: 1000, color: '#3b82f6' },
  { id: 'staff', label: 'Healthcare Staff Training', costPerUnit: 10000, impactPerUnit: 500, color: '#22c55e' },
  { id: 'infrastructure', label: 'Infrastructure Upgrade', costPerUnit: 200000, impactPerUnit: 5000, color: '#f59e0b' },
  { id: 'vaccination', label: 'Vaccination Programs', costPerUnit: 5000, impactPerUnit: 2000, color: '#8b5cf6' },
  { id: 'maternal', label: 'Maternal Health Services', costPerUnit: 25000, impactPerUnit: 1500, color: '#ec4899' },
  { id: 'insurance', label: 'Insurance Subsidies', costPerUnit: 15000, impactPerUnit: 3000, color: '#14b8a6' },
];

interface SelectedRegion {
  name: string;
  allocation: number; // percentage of total budget
}

export function ImpactCalculator() {
  const { regions } = useGhanaData();
  const [totalBudget, setTotalBudget] = useState(1000000);
  const [selectedCategory, setSelectedCategory] = useState(INVESTMENT_CATEGORIES[0].id);
  const [selectedRegions, setSelectedRegions] = useState<SelectedRegion[]>([]);
  const [draggedRegion, setDraggedRegion] = useState<string | null>(null);

  const availableRegions = useMemo(() => {
    const selectedNames = selectedRegions.map(r => r.name.toLowerCase());
    return regions.filter(r => 
      r.population2021 && 
      !selectedNames.includes(r.canonicalName.toLowerCase())
    );
  }, [regions, selectedRegions]);

  const categoryInfo = INVESTMENT_CATEGORIES.find(c => c.id === selectedCategory)!;

  const handleDragStart = useCallback((regionName: string) => {
    setDraggedRegion(regionName);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedRegion(null);
  }, []);

  const handleDrop = useCallback(() => {
    if (draggedRegion && !selectedRegions.find(r => r.name === draggedRegion)) {
      const equalShare = 100 / (selectedRegions.length + 1);
      const newRegions = selectedRegions.map(r => ({
        ...r,
        allocation: equalShare,
      }));
      newRegions.push({ name: draggedRegion, allocation: equalShare });
      setSelectedRegions(newRegions);
    }
    setDraggedRegion(null);
  }, [draggedRegion, selectedRegions]);

  const handleAddRegion = useCallback((regionName: string) => {
    if (!selectedRegions.find(r => r.name === regionName)) {
      const equalShare = 100 / (selectedRegions.length + 1);
      const newRegions = selectedRegions.map(r => ({
        ...r,
        allocation: equalShare,
      }));
      newRegions.push({ name: regionName, allocation: equalShare });
      setSelectedRegions(newRegions);
    }
  }, [selectedRegions]);

  const handleRemoveRegion = useCallback((regionName: string) => {
    const remaining = selectedRegions.filter(r => r.name !== regionName);
    if (remaining.length > 0) {
      const equalShare = 100 / remaining.length;
      setSelectedRegions(remaining.map(r => ({ ...r, allocation: equalShare })));
    } else {
      setSelectedRegions([]);
    }
  }, [selectedRegions]);

  const handleAllocationChange = useCallback((regionName: string, newValue: number) => {
    const others = selectedRegions.filter(r => r.name !== regionName);
    const remainingAllocation = 100 - newValue;
    const otherShare = remainingAllocation / others.length;
    
    setSelectedRegions(
      selectedRegions.map(r => 
        r.name === regionName 
          ? { ...r, allocation: newValue }
          : { ...r, allocation: otherShare }
      )
    );
  }, [selectedRegions]);

  const impactData = useMemo(() => {
    return selectedRegions.map(sr => {
      const region = regions.find(r => r.canonicalName === sr.name);
      const budget = (totalBudget * sr.allocation) / 100;
      const units = Math.floor(budget / categoryInfo.costPerUnit);
      const peopleImpacted = units * categoryInfo.impactPerUnit;
      const population = region?.population2021 || 0;
      const coveragePercent = population > 0 ? (peopleImpacted / population) * 100 : 0;

      return {
        name: sr.name,
        budget,
        units,
        peopleImpacted,
        population,
        coveragePercent: Math.min(coveragePercent, 100),
        allocation: sr.allocation,
        gapScore: region?.policyCompositeGapScore || 0,
      };
    });
  }, [selectedRegions, regions, totalBudget, categoryInfo]);

  const totalImpact = useMemo(() => {
    return impactData.reduce((acc, d) => acc + d.peopleImpacted, 0);
  }, [impactData]);

  const totalCoverage = useMemo(() => {
    const totalPop = impactData.reduce((acc, d) => acc + d.population, 0);
    return totalPop > 0 ? (totalImpact / totalPop) * 100 : 0;
  }, [impactData, totalImpact]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Investment Impact Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget & Category Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium">Total Budget</label>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[totalBudget]}
                onValueChange={([v]) => setTotalBudget(v)}
                min={100000}
                max={50000000}
                step={100000}
                className="flex-1"
              />
              <span className="text-sm font-medium w-16 text-right">{formatCurrency(totalBudget)}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium">Investment Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVESTMENT_CATEGORIES.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Region Selection Area */}
        <div className="grid grid-cols-2 gap-4">
          {/* Available Regions */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Available Regions</label>
            <div className="border rounded-lg p-2 h-32 overflow-y-auto bg-muted/30">
              <div className="flex flex-wrap gap-1">
                {availableRegions.map(region => (
                  <Badge
                    key={region.name}
                    variant="outline"
                    className="cursor-grab active:cursor-grabbing text-xs"
                    draggable
                    onDragStart={() => handleDragStart(region.canonicalName)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleAddRegion(region.canonicalName)}
                  >
                    <GripVertical className="w-3 h-3 mr-1" />
                    {region.canonicalName}
                    <Plus className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Regions Drop Zone */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Target Regions (drop here)</label>
            <div 
              className={`border-2 border-dashed rounded-lg p-2 h-32 overflow-y-auto transition-colors ${
                draggedRegion ? 'border-primary bg-primary/5' : 'border-muted'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {selectedRegions.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Drag regions here or click + to add
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedRegions.map(sr => (
                    <div key={sr.name} className="flex items-center gap-2 p-1 bg-background rounded border">
                      <span className="text-xs flex-1 truncate">{sr.name}</span>
                      <span className="text-xs text-muted-foreground w-10">{sr.allocation.toFixed(0)}%</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5"
                        onClick={() => handleRemoveRegion(sr.name)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Allocation Sliders */}
        {selectedRegions.length > 1 && (
          <div className="space-y-2">
            <label className="text-xs font-medium">Budget Allocation</label>
            <div className="space-y-2">
              {selectedRegions.map(sr => (
                <div key={sr.name} className="flex items-center gap-2">
                  <span className="text-xs w-24 truncate">{sr.name}</span>
                  <Slider
                    value={[sr.allocation]}
                    onValueChange={([v]) => handleAllocationChange(sr.name, v)}
                    min={5}
                    max={95}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs w-12">{sr.allocation.toFixed(0)}%</span>
                  <span className="text-xs w-16 text-right text-muted-foreground">
                    {formatCurrency((totalBudget * sr.allocation) / 100)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Impact Chart */}
        {impactData.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium">Projected Impact</label>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={impactData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={formatNumber} fontSize={10} />
                  <YAxis type="category" dataKey="name" width={80} fontSize={10} />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'peopleImpacted') return [formatNumber(value), 'People Impacted'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="peopleImpacted" name="People Impacted">
                    {impactData.map((entry, index) => (
                      <Cell key={index} fill={categoryInfo.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {impactData.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary">
                <Users className="w-4 h-4" />
                <span className="text-lg font-bold">{formatNumber(totalImpact)}</span>
              </div>
              <p className="text-xs text-muted-foreground">People Impacted</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-score-good">
                <TrendingUp className="w-4 h-4" />
                <span className="text-lg font-bold">{totalCoverage.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">Coverage Rate</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-score-medium">
                <DollarSign className="w-4 h-4" />
                <span className="text-lg font-bold">
                  ${(totalBudget / totalImpact).toFixed(0)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Cost Per Person</p>
            </div>
          </div>
        )}

        {/* Category Info */}
        <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
          <p className="font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryInfo.color }} />
            {categoryInfo.label}
          </p>
          <p className="text-muted-foreground">
            Est. {formatCurrency(categoryInfo.costPerUnit)} per unit • 
            {formatNumber(categoryInfo.impactPerUnit)} people reached per unit
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
