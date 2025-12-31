/**
 * Footfall Analysis Module
 * ========================
 * Exports all footfall analysis functionality.
 */

// Station locations and proximity
export {
    type TflStation,
    TFL_STATIONS,
    findNearbyStations,
    findStationsNearRoute
} from './stationLocations'

// TfL data loading
export {
    type FootfallRecord,
    loadTflFootfallData,
    getStationFootfall,
    get14WeekWindow,
    getFootfallForDate,
    getSameDayRecords,
    formatDateString,
    getUniqueStations,
    getDataDateRange
} from './tflDataLoader'

// Weather service
export {
    type DailyWeather,
    type WeatherImpact,
    fetchLondonWeather,
    getWeatherImpact,
    getWeatherForDate,
    isSimilarWeather,
    getWeatherEmoji
} from './weatherService'

// Statistical analysis
export {
    type BaselineStats,
    type WeatherAdjustedStats,
    type ImpactCategory,
    type AnalysisResult,
    type ChartDataPoint,
    analyzeStationFootfall,
    formatZScore,
    formatPValue
} from './statisticalAnalysis'
