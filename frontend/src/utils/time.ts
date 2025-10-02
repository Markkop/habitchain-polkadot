/**
 * Utility functions for epoch-based time handling
 */

const SECONDS_PER_DAY = 86400;

/**
 * Get current epoch (civil day since Unix epoch)
 */
export const getCurrentEpoch = (): bigint => {
  return BigInt(Math.floor(Date.now() / 1000 / SECONDS_PER_DAY));
};

/**
 * Get time remaining until UTC midnight
 * @returns Formatted string "HH:MM:SS"
 */
export const getTimeUntilMidnightUTC = (): string => {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0
    )
  );

  const diff = midnight.getTime() - now.getTime();

  const hours = Math.floor(diff / 1000 / 60 / 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Convert epoch to readable date
 * @param epoch Epoch number (days since Unix epoch)
 * @returns Formatted date string
 */
export const epochToDate = (epoch: bigint): string => {
  const timestamp = Number(epoch) * SECONDS_PER_DAY * 1000;
  return new Date(timestamp).toLocaleDateString();
};

/**
 * Get epoch for a specific date
 * @param date Date object
 * @returns Epoch number
 */
export const dateToEpoch = (date: Date): bigint => {
  return BigInt(Math.floor(date.getTime() / 1000 / SECONDS_PER_DAY));
};

/**
 * Check if it's past UTC midnight compared to a given epoch
 * @param epoch Epoch to check against
 * @returns True if current time is in a later epoch
 */
export const isEpochPast = (epoch: bigint): boolean => {
  return getCurrentEpoch() > epoch;
};

/**
 * Check if we're currently in the given epoch
 * @param epoch Epoch to check
 * @returns True if current time is in this epoch
 */
export const isCurrentEpoch = (epoch: bigint): boolean => {
  return getCurrentEpoch() === epoch;
};

