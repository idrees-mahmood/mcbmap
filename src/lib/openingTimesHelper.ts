/**
 * Opening Times Helper
 * ====================
 * Estimates whether a business is open/closed during a protest
 * based on OSM opening_hours tag or heuristic fallback.
 */

export type BusinessStatus = 'OPEN' | 'CLOSED' | 'PARTIAL' | 'UNKNOWN';

export interface BusinessStatusBreakdown {
    total: number;
    open: number;
    closed: number;
    partial: number;
    unknown: number;
    byType: {
        retail: { total: number; open: number; closed: number };
        hospitality: { total: number; open: number; closed: number };
        commercial: { total: number; open: number; closed: number };
        other: { total: number; open: number; closed: number };
    };
}

/**
 * Get day of week from Date
 */
export function getDayOfWeek(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

/**
 * Check if a day is a weekend
 */
function isWeekend(day: string): boolean {
    return day === 'Saturday' || day === 'Sunday';
}

/**
 * Estimate business status based on type and day
 * Uses heuristics when opening_hours is not available
 */
export function estimateBusinessStatus(
    type: 'retail' | 'hospitality' | 'commercial' | 'other',
    subtype: string | null,
    openingHours: string | null,
    protestDay: string,
    protestHour?: number
): BusinessStatus {
    // 1. If we have actual opening_hours data, try simple pattern matching
    if (openingHours) {
        return parseOpeningHoursSimple(openingHours, protestDay, protestHour);
    }

    // 2. Heuristic fallback based on type and day
    const weekend = isWeekend(protestDay);

    // Commercial (offices, banks)
    if (type === 'commercial') {
        // Banks: closed Sunday, partial Saturday (close at 1pm)
        if (subtype === 'bank' || subtype === 'bureau_de_change') {
            if (protestDay === 'Sunday') return 'CLOSED';
            if (protestDay === 'Saturday') return 'PARTIAL';
            return 'OPEN';
        }

        // Post offices: similar to banks
        if (subtype === 'post_office') {
            if (protestDay === 'Sunday') return 'CLOSED';
            if (protestDay === 'Saturday') return 'PARTIAL';
            return 'OPEN';
        }

        // Gyms: usually open weekends
        if (subtype === 'fitness_centre' || subtype === 'gym' || subtype === 'sports_centre') {
            return 'OPEN';
        }

        // Clinics/dentists: closed weekends
        if (subtype === 'clinic' || subtype === 'dentist') {
            return weekend ? 'CLOSED' : 'OPEN';
        }

        // Generic offices: closed weekends
        return weekend ? 'CLOSED' : 'OPEN';
    }

    // Hospitality (restaurants, cafes, bars, pubs)
    // Generally open, especially weekends
    if (type === 'hospitality') {
        return 'OPEN';
    }

    // Retail (shops)
    // Most shops open on weekends, especially Saturday
    if (type === 'retail') {
        // Sunday trading laws: many shops limited hours or closed
        if (protestDay === 'Sunday') {
            // Large stores: limited hours (usually 10-4 or 11-5)
            // Small stores: varies
            return 'PARTIAL';
        }
        return 'OPEN';
    }

    return 'UNKNOWN';
}

/**
 * Simple opening_hours parser for common patterns
 * Full parsing would require a library like 'opening_hours'
 */
function parseOpeningHoursSimple(
    openingHours: string,
    protestDay: string,
    _protestHour?: number // Reserved for future time-based parsing
): BusinessStatus {
    const dayAbbrev = getDayAbbreviation(protestDay);
    const oh = openingHours.toLowerCase();

    // Check for explicit closed indicators
    if (oh === 'closed' || oh === 'off') {
        return 'CLOSED';
    }

    // Check for 24/7
    if (oh === '24/7' || oh.includes('24 hours')) {
        return 'OPEN';
    }

    // Check if day is mentioned at all
    if (oh.includes(dayAbbrev)) {
        // Day is mentioned - likely open (or has specific hours)
        // Check for "off" after the day
        const dayPattern = new RegExp(`${dayAbbrev}[^;]*off`, 'i');
        if (dayPattern.test(oh)) {
            return 'CLOSED';
        }
        return 'OPEN';
    }

    // Check for day ranges like "Mo-Fr" or "Mo-Sa"
    const dayRanges = [
        { pattern: /mo-fr/i, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
        { pattern: /mo-sa/i, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
        { pattern: /mo-su/i, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    ];

    for (const range of dayRanges) {
        if (range.pattern.test(oh)) {
            if (range.days.includes(protestDay)) {
                return 'OPEN';
            }
        }
    }

    // If we can't determine, return unknown
    return 'UNKNOWN';
}

/**
 * Get 2-letter day abbreviation
 */
function getDayAbbreviation(day: string): string {
    const abbrevs: Record<string, string> = {
        'Monday': 'mo',
        'Tuesday': 'tu',
        'Wednesday': 'we',
        'Thursday': 'th',
        'Friday': 'fr',
        'Saturday': 'sa',
        'Sunday': 'su'
    };
    return abbrevs[day] || day.toLowerCase().slice(0, 2);
}

/**
 * Calculate status breakdown for a list of businesses
 */
export function calculateStatusBreakdown(
    businesses: Array<{
        type: 'retail' | 'hospitality' | 'commercial' | 'other';
        subtype: string | null;
        opening_hours?: string | null;
    }>,
    protestDay: string,
    protestHour?: number
): BusinessStatusBreakdown {
    const breakdown: BusinessStatusBreakdown = {
        total: businesses.length,
        open: 0,
        closed: 0,
        partial: 0,
        unknown: 0,
        byType: {
            retail: { total: 0, open: 0, closed: 0 },
            hospitality: { total: 0, open: 0, closed: 0 },
            commercial: { total: 0, open: 0, closed: 0 },
            other: { total: 0, open: 0, closed: 0 }
        }
    };

    for (const business of businesses) {
        const status = estimateBusinessStatus(
            business.type,
            business.subtype,
            business.opening_hours || null,
            protestDay,
            protestHour
        );

        // Update totals
        breakdown.byType[business.type].total++;

        switch (status) {
            case 'OPEN':
                breakdown.open++;
                breakdown.byType[business.type].open++;
                break;
            case 'CLOSED':
                breakdown.closed++;
                breakdown.byType[business.type].closed++;
                break;
            case 'PARTIAL':
                breakdown.partial++;
                // Count partial as "affected" for open count
                breakdown.byType[business.type].open++;
                break;
            case 'UNKNOWN':
                breakdown.unknown++;
                // Count unknown as open (conservative estimate of impact)
                breakdown.byType[business.type].open++;
                break;
        }
    }

    return breakdown;
}
