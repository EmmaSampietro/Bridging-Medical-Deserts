import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RankingTable } from '@/types/analysis';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RankingTableCardProps {
  data: RankingTable;
}

export function RankingTableCard({ data }: RankingTableCardProps) {
  const formatValue = (value: any, format?: string) => {
    if (value === null || value === undefined) return '-';
    
    switch (format) {
      case 'percent':
        return `${typeof value === 'number' ? value.toFixed(1) : value}%`;
      case 'score':
        return typeof value === 'number' ? value.toFixed(1) : value;
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          notation: 'compact',
          maximumFractionDigits: 1
        }).format(value);
      case 'number':
        return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
      default:
        return value;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">{data.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                {data.columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, idx) => (
                <TableRow 
                  key={idx}
                  className={cn(
                    data.highlightTop && idx < data.highlightTop && 'bg-primary/5'
                  )}
                >
                  <TableCell className="font-medium">
                    {idx < 3 ? (
                      <span className={cn(
                        'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                        idx === 0 && 'bg-primary/20 text-primary',
                        idx === 1 && 'bg-muted text-muted-foreground',
                        idx === 2 && 'bg-secondary text-secondary-foreground'
                      )}>
                        {idx + 1}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{idx + 1}</span>
                    )}
                  </TableCell>
                  {data.columns.map((col) => (
                    <TableCell key={col.key}>
                      {formatValue(row[col.key], col.format)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
