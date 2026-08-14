import { format as dateFnsFormat, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const EASTERN_TIMEZONE = 'America/New_York';

/**
 * Format a date/timestamp to Eastern Time
 */
export function formatInEasternTime(
  date: Date | string | number,
  formatStr: string = 'MMM d, yyyy \'at\' h:mm a'
): string {
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      // Handle ISO string or date string
      dateObj = parseISO(date);
    } else if (typeof date === 'number') {
      // Handle timestamp
      dateObj = new Date(date);
    } else {
      // Already a Date object
      dateObj = date;
    }

    // Format in Eastern Time
    return formatInTimeZone(dateObj, EASTERN_TIMEZONE, formatStr);
  } catch (error) {
    console.error('Error formatting date in Eastern Time:', error);
    return 'Invalid Date';
  }
}

/**
 * Format a date to Eastern Time with common formats
 */
export const formatDateEST = {
  /**
   * Format as "Jan 15, 2024 at 3:45 PM"
   */
  full: (date: Date | string | number) => 
    formatInEasternTime(date, 'MMM d, yyyy \'at\' h:mm a'),
  
  /**
   * Format as "12/19/2024"
   */
  date: (date: Date | string | number) => 
    formatInEasternTime(date, 'MM/dd/yyyy'),
  
  /**
   * Format as "3:45 PM"
   */
  time: (date: Date | string | number) => 
    formatInEasternTime(date, 'h:mm a'),
  
  /**
   * Format as "01/15/24"
   */
  short: (date: Date | string | number) => 
    formatInEasternTime(date, 'MM/dd/yy'),
  
  /**
   * Format as "2024-01-15" (date only)
   */
  dateOnly: (date: Date | string | number) => 
    formatInEasternTime(date, 'yyyy-MM-dd'),
  
  /**
   * Format for API monitoring timestamps
   */
  timestamp: (date: Date | string | number) => 
    formatInEasternTime(date, 'MMM d, h:mm:ss a'),
  
  /**
   * Format as relative time with Eastern timezone context
   */
  relative: (date: Date | string | number) => {
    try {
      const now = new Date();
      const targetDate = typeof date === 'string' ? parseISO(date) : new Date(date);
      const diffInMinutes = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
      
      // For older dates, show full Eastern time
      return formatInEasternTime(date, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error calculating relative time:', error);
      return formatInEasternTime(date, 'MMM d, yyyy');
    }
  }
};

/**
 * Get current Eastern Time
 */
export function getCurrentEasternTime(): Date {
  return toZonedTime(new Date(), EASTERN_TIMEZONE);
}

/**
 * Convert any date to Eastern Time Date object
 */
export function toEasternTime(date: Date | string | number): Date {
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    // Use toZonedTime for accurate timezone conversion
    return toZonedTime(dateObj, EASTERN_TIMEZONE);
  } catch (error) {
    console.error('Error converting to Eastern Time:', error);
    return new Date();
  }
}

/**
 * Check if we're currently in EDT (Daylight Time) or EST (Standard Time)
 */
export function getCurrentEasternTimeZoneAbbr(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: EASTERN_TIMEZONE, 
      timeZoneName: 'short' 
    });
    const parts = formatter.formatToParts(new Date());
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart?.value || 'ET';
  } catch (error) {
    console.error('Error getting Eastern timezone abbreviation:', error);
    return 'ET';
  }
}