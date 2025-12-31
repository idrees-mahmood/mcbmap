/**
 * Business Status Helper
 * ======================
 * Combines business data with opening hours analysis to produce
 * status-enriched business information for map markers and UI display.
 */

import type { BusinessNode } from './businessCounter'
import { estimateBusinessStatus, type BusinessStatus, getDayOfWeek } from './openingTimesHelper'

/**
 * Business with computed open/closed status
 */
export interface BusinessWithStatus extends BusinessNode {
    status: BusinessStatus
    statusLabel: string
    statusColor: string
}

/**
 * Summary of business statuses
 */
export interface BusinessStatusSummary {
    total: number
    open: number
    closed: number
    partial: number
    unknown: number
    actuallyAffected: number  // Open + Partial
    wouldBeClosed: number     // Closed (not actually impacted)
}

/**
 * Compute status for all businesses based on protest date/time
 */
export function computeBusinessStatuses(
    businesses: BusinessNode[],
    protestDate: string,
    protestStartTime?: string
): BusinessWithStatus[] {
    // Parse the protest date to get day of week
    const date = new Date(protestDate)
    const dayOfWeek = getDayOfWeek(date)

    // Parse protest start hour if provided (e.g., "14:00" -> 14)
    let protestHour: number | undefined
    if (protestStartTime) {
        const hourMatch = protestStartTime.match(/^(\d{1,2})/)
        if (hourMatch) {
            protestHour = parseInt(hourMatch[1], 10)
        }
    }

    return businesses.map(business => {
        const status = estimateBusinessStatus(
            business.type,
            business.subtype,
            business.opening_hours || null,
            dayOfWeek,
            protestHour
        )

        return {
            ...business,
            status,
            statusLabel: getStatusLabel(status),
            statusColor: getStatusColor(status)
        }
    })
}

/**
 * Get human-readable label for status
 */
function getStatusLabel(status: BusinessStatus): string {
    switch (status) {
        case 'OPEN': return 'Open'
        case 'CLOSED': return 'Closed'
        case 'PARTIAL': return 'Partial Hours'
        case 'UNKNOWN': return 'Unknown'
    }
}

/**
 * Get CSS color class for status
 */
function getStatusColor(status: BusinessStatus): string {
    switch (status) {
        case 'OPEN': return '#22c55e'      // Green
        case 'CLOSED': return '#ef4444'    // Red
        case 'PARTIAL': return '#eab308'   // Yellow
        case 'UNKNOWN': return '#64748b'   // Gray
    }
}

/**
 * Get emoji for status
 */
export function getStatusEmoji(status: BusinessStatus): string {
    switch (status) {
        case 'OPEN': return '🟢'
        case 'CLOSED': return '🔴'
        case 'PARTIAL': return '🟡'
        case 'UNKNOWN': return '⚪'
    }
}

/**
 * Get color for business type (for map markers)
 */
export function getTypeColor(type: 'retail' | 'hospitality' | 'commercial' | 'other'): string {
    switch (type) {
        case 'retail': return '#3b82f6'      // Blue
        case 'hospitality': return '#f97316' // Orange
        case 'commercial': return '#a855f7'  // Purple
        case 'other': return '#64748b'       // Gray
    }
}

/**
 * Calculate summary statistics from businesses with status
 */
export function calculateStatusSummary(businesses: BusinessWithStatus[]): BusinessStatusSummary {
    const summary: BusinessStatusSummary = {
        total: businesses.length,
        open: 0,
        closed: 0,
        partial: 0,
        unknown: 0,
        actuallyAffected: 0,
        wouldBeClosed: 0
    }

    for (const business of businesses) {
        switch (business.status) {
            case 'OPEN':
                summary.open++
                summary.actuallyAffected++
                break
            case 'CLOSED':
                summary.closed++
                summary.wouldBeClosed++
                break
            case 'PARTIAL':
                summary.partial++
                summary.actuallyAffected++
                break
            case 'UNKNOWN':
                summary.unknown++
                // Count unknown as potentially affected (conservative)
                summary.actuallyAffected++
                break
        }
    }

    return summary
}

/**
 * Convert businesses with status to GeoJSON for map display
 */
export function businessesToGeoJSON(businesses: BusinessWithStatus[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = businesses.map(business => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [business.lng, business.lat]
        },
        properties: {
            id: business.id,
            name: business.name || 'Unnamed Business',
            type: business.type,
            subtype: business.subtype,
            status: business.status,
            statusLabel: business.statusLabel,
            statusColor: business.statusColor,
            typeColor: getTypeColor(business.type),
            openingHours: business.opening_hours || null
        }
    }))

    return {
        type: 'FeatureCollection',
        features
    }
}
