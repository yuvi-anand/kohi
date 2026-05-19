import { Rating } from './types';

// coffee 60%, vibes 40% — seating/wifi/pastries are informational only
// with pastries: coffee 57%, vibes 37%, pastries 6%
export function computeOverall(
  coffee_quality: number,
  vibes: number,
  seating: number,
  wifi_quality: number,
  pastries?: number | null
): number {
  if (pastries != null) {
    const score =
      (coffee_quality / 10) * 0.52 +
      (vibes / 10) * 0.42 +
      (pastries / 5) * 0.06;
    return Math.round(score * 100) / 10;
  }
  const score =
    (coffee_quality / 10) * 0.55 +
    (vibes / 10) * 0.45;
  return Math.round(score * 100) / 10;
}

export function formatScore(score: number): string {
  return score % 1 === 0 ? score.toFixed(0) : score.toFixed(1);
}

export function overallColor(score: number): string {
  if (score >= 8) return '#4E9F6A';
  if (score >= 6) return '#C87941';
  return '#D4463B';
}

export function priceString(level?: number): string {
  if (!level) return '';
  return '$'.repeat(level);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
