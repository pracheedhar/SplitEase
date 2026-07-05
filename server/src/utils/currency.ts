import { cacheGet, cacheSet } from './cache.js';
import { logger } from './logger.js';

const EXCHANGE_RATE_TTL = 60 * 60; // 1-hour cache
const CACHE_KEY_PREFIX = 'exchange_rate:';

/**
 * Fetches live exchange rates with a 1-hour Redis cache.
 * Falls back to 1:1 conversion if the API is unavailable.
 */
export const getExchangeRate = async (
  from: string,
  to: string
): Promise<number> => {
  if (from.toUpperCase() === to.toUpperCase()) return 1;

  const cacheKey = `${CACHE_KEY_PREFIX}${from.toUpperCase()}_${to.toUpperCase()}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return parseFloat(cached);

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
      logger.warn('EXCHANGE_RATE_API_KEY not set — using 1:1 conversion');
      return 1;
    }

    // Using Open Exchange Rates API (free tier)
    const url = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD&symbols=${from.toUpperCase()},${to.toUpperCase()}`;
    const res = await fetch(url);
    const json = (await res.json()) as { rates: Record<string, number> };

    const fromRate = json.rates[from.toUpperCase()] || 1;
    const toRate = json.rates[to.toUpperCase()] || 1;
    const rate = toRate / fromRate;

    await cacheSet(cacheKey, rate.toString(), EXCHANGE_RATE_TTL);
    return rate;
  } catch (err: any) {
    logger.warn(`Exchange rate fetch failed: ${err.message}. Using 1:1 conversion.`);
    return 1;
  }
};

/**
 * Converts an amount from one currency to another.
 */
export const convertCurrency = async (
  amount: number,
  from: string,
  to: string
): Promise<number> => {
  const rate = await getExchangeRate(from, to);
  return Math.round(amount * rate * 100) / 100;
};
