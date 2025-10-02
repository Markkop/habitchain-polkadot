import { formatEther, parseEther } from "viem";

/**
 * Format wei balance to readable PAS amount
 * @param balance Balance in wei
 * @param decimals Number of decimal places to show
 * @returns Formatted string with PAS suffix
 */
export const formatBalance = (balance: bigint, decimals: number = 2): string => {
  const formatted = formatEther(balance);
  const num = parseFloat(formatted);
  return `${num.toFixed(decimals)} PAS`;
};

/**
 * Parse PAS amount to wei
 * @param amount Amount as string (e.g., "10.5")
 * @returns BigInt in wei
 */
export const parseAmount = (amount: string): bigint => {
  try {
    return parseEther(amount);
  } catch (error) {
    throw new Error("Invalid amount format");
  }
};

/**
 * Truncate address for display
 * @param address Full address
 * @param startChars Number of characters to show at start
 * @param endChars Number of characters to show at end
 * @returns Truncated address (e.g., "0x1234...5678")
 */
export const truncateAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Format number with thousand separators
 * @param num Number to format
 * @returns Formatted string
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

/**
 * Calculate percentage
 * @param part Partial value
 * @param total Total value
 * @returns Percentage as number (0-100)
 */
export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
};

