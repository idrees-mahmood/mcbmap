/**
 * LLM Analysis Prompt Generator
 * ==============================
 * Generates structured prompts for LLM analysis of protest impact data.
 * Designed to produce unbiased, evidence-based analysis.
 */

import type { ProtestWithRoute } from './database.types'
import type { BusinessWithStatus } from './businessStatusHelper'

export interface AnalysisData {
    protest: ProtestWithRoute
    businesses: BusinessWithStatus[]
    summary: {
        total: number
        open: number
        closed: number
        partiallyOpen: number
        unknown: number
        byType: {
            retail: number
            hospitality: number
            commercial: number
            other: number
        }
    }
}

/**
 * Generate analysis data summary from protest and businesses
 */
export function generateAnalysisSummary(
    protest: ProtestWithRoute,
    businesses: BusinessWithStatus[]
): AnalysisData {
    const summary = {
        total: businesses.length,
        open: businesses.filter(b => b.status === 'OPEN').length,
        closed: businesses.filter(b => b.status === 'CLOSED').length,
        partiallyOpen: businesses.filter(b => b.status === 'PARTIAL').length,
        unknown: businesses.filter(b => b.status === 'UNKNOWN').length,
        byType: {
            retail: businesses.filter(b => b.type === 'retail').length,
            hospitality: businesses.filter(b => b.type === 'hospitality').length,
            commercial: businesses.filter(b => b.type === 'commercial').length,
            other: businesses.filter(b => b.type === 'other').length
        }
    }

    return { protest, businesses, summary }
}

/**
 * Generate an LLM prompt for unbiased analysis of protest impact
 */
export function generateLLMPrompt(data: AnalysisData): string {
    const { protest, summary } = data

    // Format date and time
    const eventDate = new Date(protest.event_date).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    const routeDistance = protest.route?.distance_meters
        ? (protest.route.distance_meters / 1000).toFixed(2)
        : 'Unknown'

    // Calculate actual commercial impact
    const businessesThatWouldBeOpen = summary.open + summary.partiallyOpen
    const percentOpenDuringProtest = summary.total > 0
        ? ((businessesThatWouldBeOpen / summary.total) * 100).toFixed(1)
        : '0'

    return `## Independent Analysis Request: Protest Commercial Impact Assessment

### Context
This is an automated data export from a protest impact tracking system. The aim is to provide factual data for academic and journalistic analysis of the Metropolitan Police's claims regarding protest disruption to businesses.

### Background (from The Guardian, 20 December 2025)
Legal experts have argued that the Met Police are "using outdated powers to police pro-Palestine protests." Claims of "serious disruption to the life of the community" are being scrutinized.

---

### Event Details
- **Protest Name**: ${protest.name}
- **Date**: ${eventDate}
- **Time**: ${protest.start_time} to ${protest.end_time}
- **Day of Week**: ${new Date(protest.event_date).toLocaleDateString('en-GB', { weekday: 'long' })}
- **Route Length**: ${routeDistance} km

### Businesses in 100m Buffer Zone (Impact Area)

| Metric | Count |
|--------|-------|
| **Total Businesses/POIs** | ${summary.total.toLocaleString()} |
| Would Be Open During Protest | ${businessesThatWouldBeOpen.toLocaleString()} (${percentOpenDuringProtest}%) |
| Already Closed (weekend/evening) | ${summary.closed.toLocaleString()} |
| Partially Open | ${summary.partiallyOpen.toLocaleString()} |
| Unknown Hours | ${summary.unknown.toLocaleString()} |

### Breakdown by Type

| Type | Count | % of Total |
|------|-------|-----------|
| Retail (shops) | ${summary.byType.retail.toLocaleString()} | ${summary.total > 0 ? ((summary.byType.retail / summary.total) * 100).toFixed(1) : 0}% |
| Hospitality (restaurants, hotels) | ${summary.byType.hospitality.toLocaleString()} | ${summary.total > 0 ? ((summary.byType.hospitality / summary.total) * 100).toFixed(1) : 0}% |
| Commercial (offices, banks) | ${summary.byType.commercial.toLocaleString()} | ${summary.total > 0 ? ((summary.byType.commercial / summary.total) * 100).toFixed(1) : 0}% |
| Other (landmarks, public buildings) | ${summary.byType.other.toLocaleString()} | ${summary.total > 0 ? ((summary.byType.other / summary.total) * 100).toFixed(1) : 0}% |

---

### Analysis Request

Please provide an **unbiased, evidence-based analysis** addressing the following:

1. **Commercial Impact Assessment**: Based on the data, what is the actual level of commercial disruption? Consider:
   - The percentage of businesses actually operating during the protest time
   - Whether weekend/evening protests affect businesses differently
   - The types of businesses most/least affected

2. **Proportionality Analysis**: Does the data support claims of "serious disruption to the life of the community"? Consider:
   - The route length vs. number of affected premises
   - The typical footfall during protest hours
   - Comparable data from non-protest events (football matches, festivals, etc.)

3. **Methodological Notes**: What limitations exist in this data?
   - Opening hours data may be incomplete
   - "In buffer zone" does not mean "unable to trade"
   - Pedestrian protests may increase footfall for some businesses

4. **Conclusion**: Based solely on the data provided, does the evidence support or challenge the premise that this protest caused "serious disruption"?

---

*Data source: OpenStreetMap POI data via Overpass API. Opening hours from OSM where available, otherwise estimated based on business type and day of week.*
`
}

/**
 * Generate a compact JSON version for console logging
 */
export function generateConsoleLogData(data: AnalysisData): string {
    const { protest, summary } = data

    return JSON.stringify({
        protest: {
            name: protest.name,
            date: protest.event_date,
            time: `${protest.start_time} - ${protest.end_time}`,
            routeKm: protest.route?.distance_meters
                ? (protest.route.distance_meters / 1000).toFixed(2)
                : null
        },
        impact: {
            totalPOIs: summary.total,
            wouldBeOpen: summary.open + summary.partiallyOpen,
            alreadyClosed: summary.closed,
            percentOpen: summary.total > 0
                ? ((summary.open + summary.partiallyOpen) / summary.total * 100).toFixed(1) + '%'
                : '0%'
        },
        byType: summary.byType
    }, null, 2)
}

/**
 * Log analysis data to console and return the LLM prompt
 */
export function logAndGeneratePrompt(
    protest: ProtestWithRoute,
    businesses: BusinessWithStatus[]
): string {
    const data = generateAnalysisSummary(protest, businesses)

    console.log('─'.repeat(60))
    console.log('📊 PROTEST IMPACT ANALYSIS DATA')
    console.log('─'.repeat(60))
    console.log(generateConsoleLogData(data))
    console.log('─'.repeat(60))
    console.log('📋 Copy the above JSON or use the LLM prompt below for analysis')
    console.log('─'.repeat(60))

    return generateLLMPrompt(data)
}
