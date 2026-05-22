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

export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NON_COFFEE_SHOPS = [
  "mcdonald's", 'mcdonalds', 'mccafe', 'mccafé',
  'burger king', "wendy's", 'wendys', 'taco bell',
  'chick-fil-a', 'chick fil a', 'subway', 'chipotle',
  '7-eleven', '7eleven', 'wawa', 'sheetz', "casey's",
  'speedway', 'circle k', 'bp station', 'shell station',
  'target', 'walmart', 'costco', 'whole foods',
  'krispy kreme', 'dunkin',
  'extramile', 'extra mile', 'chevron', 'arco', 'mobil',
  'exxon', 'valero', 'marathon', 'sunoco', 'pilot',
  'flying j', 'loves travel', "love's",
];

export function isNonCoffeeShop(name: string): boolean {
  const lower = name.toLowerCase();
  return NON_COFFEE_SHOPS.some((chain) => lower.includes(chain));
}

export function getClosingSoon(
  hours: string[] | null | undefined,
  openNow?: boolean | null
): { label: string; urgent: boolean } | null {
  // Only show warning when shop is confirmed open
  if (!openNow || !hours || hours.length === 0) return null;

  // Google weekdayDescriptions: index 0 = Monday … 6 = Sunday
  // JS getDay(): 0 = Sunday, 1 = Monday … 6 = Saturday → convert
  const jsDay = new Date().getDay();
  const googleDay = (jsDay + 6) % 7;
  const todayDesc = hours[googleDay];
  if (!todayDesc) return null;
  if (todayDesc.toLowerCase().includes('closed')) return null;

  // Match closing time after the dash, e.g. "7:00 AM – 9:00 PM" or "7:00 AM - 9:00 PM"
  const match = todayDesc.match(/[–\-]\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  if (!match) return null;

  const closingStr = match[1].trim();
  const timeMatch = closingStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const ampm = timeMatch[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const now = new Date();
  const closing = new Date();
  closing.setHours(hour, minute, 0, 0);
  // Handle past-midnight closing
  if (closing.getTime() < now.getTime()) closing.setDate(closing.getDate() + 1);

  const minutesLeft = Math.round((closing.getTime() - now.getTime()) / 60000);
  if (minutesLeft > 60 || minutesLeft < 0) return null;

  return {
    label: minutesLeft <= 10
      ? `Closes in ${minutesLeft} min`
      : `Closes @ ${closingStr}`,
    urgent: minutesLeft <= 30,
  };
}

export const NORMALIZE_THRESHOLD = 5;

/**
 * Normalizes a raw score so the user's personal best = 10.
 * Formula: (raw / userMax) * 10
 * Only call this when the user has >= NORMALIZE_THRESHOLD ratings.
 */
export function normalizeScore(raw: number, userMax: number): number {
  if (userMax <= 0) return raw;
  return Math.round((raw / userMax) * 100) / 10;
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
