import { Rating } from './types';

// coffee/vibes are 1–10; seating/wifi/pastries are 1–5
// pastries may be null (N/A) — excluded from score when null
// without pastries: coffee 40%, vibes 35%, seating 15%, wifi 10%
// with pastries: coffee 38%, vibes 33%, seating 14%, wifi 9%, pastries 6%
export function computeOverall(
  coffee_quality: number,
  vibes: number,
  seating: number,
  wifi_quality: number,
  pastries?: number | null
): number {
  if (pastries != null) {
    const score =
      (coffee_quality / 10) * 0.38 +
      (vibes / 10) * 0.33 +
      (seating / 5) * 0.14 +
      (wifi_quality / 5) * 0.09 +
      (pastries / 5) * 0.06;
    return Math.round(score * 100) / 10;
  }
  const score =
    (coffee_quality / 10) * 0.40 +
    (vibes / 10) * 0.35 +
    (seating / 5) * 0.15 +
    (wifi_quality / 5) * 0.10;
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
