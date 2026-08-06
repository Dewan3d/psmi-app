// ============================================================
// PSMI System — FIFO Utility
// ============================================================
// Calculates age and color-coded buckets for inventory units
// to encourage First-In, First-Out dispatching.
// ============================================================

import { InventoryUnit, FifoUnit } from '@/lib/types/database';

/**
 * Age bucket thresholds (in days)
 * - green: < 30 days (fresh stock)
 * - amber: 30–60 days (aging, prioritize dispatch)
 * - red: > 60 days (old stock, dispatch immediately)
 */
const AGE_THRESHOLDS = {
  AMBER: 30,
  RED: 60,
} as const;

/**
 * Calculate the age in days from a date string to now
 */
export function calculateAgeDays(uploadDate: string): number {
  const uploaded = new Date(uploadDate);
  const now = new Date();
  const diffMs = now.getTime() - uploaded.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine the age bucket for a given number of days
 */
export function getAgeBucket(ageDays: number): 'green' | 'amber' | 'red' {
  if (ageDays >= AGE_THRESHOLDS.RED) return 'red';
  if (ageDays >= AGE_THRESHOLDS.AMBER) return 'amber';
  return 'green';
}

/**
 * Get the display label for an age bucket
 */
export function getAgeBucketLabel(bucket: 'green' | 'amber' | 'red'): string {
  switch (bucket) {
    case 'green':
      return 'Fresh (< 30 days)';
    case 'amber':
      return 'Aging (30–60 days)';
    case 'red':
      return 'Old (> 60 days)';
  }
}

/**
 * Get the Tailwind CSS classes for an age bucket badge
 */
export function getAgeBucketColor(bucket: 'green' | 'amber' | 'red'): string {
  switch (bucket) {
    case 'green':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'amber':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'red':
      return 'bg-red-100 text-red-800 border-red-200';
  }
}

/**
 * Enrich inventory units with age information and sort by FIFO
 * (oldest first — ascending upload date)
 */
export function enrichWithFifo(units: InventoryUnit[]): FifoUnit[] {
  return units
    .map((unit) => {
      const age_days = calculateAgeDays(unit.upload_date);
      return {
        ...unit,
        age_days,
        age_bucket: getAgeBucket(age_days),
      };
    })
    .sort((a, b) => a.age_days - b.age_days)
    .reverse(); // Oldest first (most days = highest priority)
}

/**
 * Get FIFO statistics for a set of units
 */
export function getFifoStats(units: FifoUnit[]): {
  total: number;
  green: number;
  amber: number;
  red: number;
  averageAgeDays: number;
  oldestAgeDays: number;
} {
  const stats = {
    total: units.length,
    green: 0,
    amber: 0,
    red: 0,
    averageAgeDays: 0,
    oldestAgeDays: 0,
  };

  if (units.length === 0) return stats;

  let totalDays = 0;

  for (const unit of units) {
    totalDays += unit.age_days;
    stats[unit.age_bucket]++;
    if (unit.age_days > stats.oldestAgeDays) {
      stats.oldestAgeDays = unit.age_days;
    }
  }

  stats.averageAgeDays = Math.round(totalDays / units.length);
  return stats;
}
