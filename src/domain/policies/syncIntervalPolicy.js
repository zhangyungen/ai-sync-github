import { ERROR_CODE, SyncError } from "../../constants/errors.js";

export function validateInterval(intervalMinutes, minIntervalMinutes, maxIntervalMinutes) {
  const interval = Number(intervalMinutes);
  const min = Number(minIntervalMinutes);
  const max = Number(maxIntervalMinutes);

  if (!Number.isFinite(interval) || !Number.isInteger(interval) || interval <= 0) {
    throw new SyncError(
      ERROR_CODE.INVALID_INTERVAL,
      "Auto sync interval must be a positive integer."
    );
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
    throw new SyncError(
      ERROR_CODE.INVALID_INTERVAL,
      "Invalid interval range settings."
    );
  }

  if (interval < min || interval > max) {
    throw new SyncError(
      ERROR_CODE.INVALID_INTERVAL,
      `Interval ${interval} is out of range [${min}, ${max}].`
    );
  }

  return interval;
}
