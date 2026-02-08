import { cn } from '@/lib/utils';
import { getScoreLevel, type ScoreLevel } from '@/types/hospital';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

const levelLabels: Record<ScoreLevel, string> = {
  critical: 'Critical',
  low: 'Low',
  medium: 'Medium',
  good: 'Good',
  excellent: 'Excellent',
};

const levelColors: Record<ScoreLevel, { bg: string; text: string; ring: string }> = {
  critical: {
    bg: 'bg-score-critical/15',
    text: 'text-score-critical',
    ring: 'ring-score-critical/30',
  },
  low: {
    bg: 'bg-score-low/15',
    text: 'text-score-low',
    ring: 'ring-score-low/30',
  },
  medium: {
    bg: 'bg-score-medium/15',
    text: 'text-score-medium',
    ring: 'ring-score-medium/30',
  },
  good: {
    bg: 'bg-score-good/15',
    text: 'text-score-good',
    ring: 'ring-score-good/30',
  },
  excellent: {
    bg: 'bg-score-excellent/15',
    text: 'text-score-excellent',
    ring: 'ring-score-excellent/30',
  },
};

export function ScoreBadge({ score, size = 'md', showLabel = false, className }: ScoreBadgeProps) {
  const level = getScoreLevel(score);
  const colors = levelColors[level];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-bold ring-2',
          sizeClasses[size],
          colors.bg,
          colors.text,
          colors.ring
        )}
      >
        {score}
      </div>
      {showLabel && (
        <span className={cn('text-sm font-medium', colors.text)}>
          {levelLabels[level]}
        </span>
      )}
    </div>
  );
}

interface ScoreBarProps {
  score: number;
  maxScore?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function ScoreBar({ score, maxScore = 10, label, showValue = true, className }: ScoreBarProps) {
  const level = getScoreLevel(score);
  const colors = levelColors[level];
  const percentage = (score / maxScore) * 100;

  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showValue && (
            <span className={cn('font-semibold', colors.text)}>
              {score}/{maxScore}
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            level === 'critical' && 'bg-score-critical',
            level === 'low' && 'bg-score-low',
            level === 'medium' && 'bg-score-medium',
            level === 'good' && 'bg-score-good',
            level === 'excellent' && 'bg-score-excellent'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ScoreRadialProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function ScoreRadial({ 
  score, 
  maxScore = 10, 
  size = 80, 
  strokeWidth = 6,
  label,
  className 
}: ScoreRadialProps) {
  const level = getScoreLevel(score);
  const colors = levelColors[level];
  const percentage = (score / maxScore) * 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const strokeColor = {
    critical: 'stroke-score-critical',
    low: 'stroke-score-low',
    medium: 'stroke-score-medium',
    good: 'stroke-score-good',
    excellent: 'stroke-score-excellent',
  }[level];

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-secondary fill-none"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={cn('fill-none transition-all duration-700 ease-out', strokeColor)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold text-lg', colors.text)}>{score.toFixed(1)}</span>
        </div>
      </div>
      {label && (
        <span className="text-xs text-muted-foreground text-center max-w-[80px] leading-tight">
          {label}
        </span>
      )}
    </div>
  );
}
