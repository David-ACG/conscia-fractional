const MONTH_MAP: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const DATE_PATTERN =
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+at\s+(\d{1,2})-(\d{2})/;

/**
 * Parse meeting date/time from a recording filename.
 * E.g. "Conscia - 1 Apr at 17-06.m4a" -> Date for 1 April at 17:06
 */
export function parseMeetingDateFromFilename(filename: string): Date | null {
  const match = filename.match(DATE_PATTERN);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTH_MAP[match[2]];
  const hours = parseInt(match[3], 10);
  const minutes = parseInt(match[4], 10);

  if (month === undefined) return null;

  const now = new Date();
  let year = now.getFullYear();

  // If the parsed month is in the future, use previous year
  // (handles Dec recordings viewed in January)
  const candidateDate = new Date(year, month, day);
  if (candidateDate > now) {
    year -= 1;
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}
