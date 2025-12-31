/**
 * Footfall Chart
 * ==============
 * Time series visualization of footfall with baseline and annotations.
 */

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import type { ChartDataPoint, BaselineStats } from '../../lib/footfallAnalysis'
import { getWeatherEmoji } from '../../lib/footfallAnalysis'

interface Props {
    data: ChartDataPoint[]
    baseline: BaselineStats
    protestDayOfWeek: string
}

export function FootfallChart({ data, baseline, protestDayOfWeek }: Props) {
    // Filter to same day of week for cleaner chart
    const sameDayData = data.filter(d => d.dayOfWeek === protestDayOfWeek)

    // Prepare chart data
    const chartData = sameDayData.map(d => ({
        date: formatDateShort(d.date),
        fullDate: d.dateString,
        footfall: d.footfall,
        isProtestDay: d.isProtestDay,
        weather: d.weather,
        // Add bands
        mean: baseline.mean,
        upper1: baseline.mean + baseline.stdDev,
        lower1: baseline.mean - baseline.stdDev,
        upper2: baseline.mean + 2 * baseline.stdDev,
        lower2: baseline.mean - 2 * baseline.stdDev
    }))

    return (
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="footfallGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

                    <XAxis
                        dataKey="date"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={{ stroke: '#475569' }}
                        tickLine={{ stroke: '#475569' }}
                    />

                    <YAxis
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={{ stroke: '#475569' }}
                        tickLine={{ stroke: '#475569' }}
                        width={45}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                    />

                    {/* ±2 std dev band (light) */}
                    <Area
                        type="monotone"
                        dataKey="upper2"
                        stroke="none"
                        fill="#475569"
                        fillOpacity={0.1}
                    />

                    {/* Mean line */}
                    <ReferenceLine
                        y={baseline.mean}
                        stroke="#22c55e"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                    />

                    {/* ±1 std dev lines */}
                    <ReferenceLine
                        y={baseline.mean + baseline.stdDev}
                        stroke="#eab308"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        strokeOpacity={0.5}
                    />
                    <ReferenceLine
                        y={baseline.mean - baseline.stdDev}
                        stroke="#eab308"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        strokeOpacity={0.5}
                    />

                    {/* Main footfall line */}
                    <Area
                        type="monotone"
                        dataKey="footfall"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#footfallGradient)"
                        dot={(props: any) => {
                            const { cx, cy, payload } = props
                            if (payload.isProtestDay) {
                                return (
                                    <circle
                                        key={`dot-${payload.fullDate}`}
                                        cx={cx}
                                        cy={cy}
                                        r={6}
                                        fill="#ef4444"
                                        stroke="#fff"
                                        strokeWidth={2}
                                    />
                                )
                            }
                            return null
                        }}
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}
                        labelStyle={{ color: '#e2e8f0' }}
                        itemStyle={{ color: '#3b82f6' }}
                        formatter={(value: any, name?: string, props?: any) => {
                            if (name === 'footfall' && typeof value === 'number' && props) {
                                const point = props.payload
                                return [
                                    <span key="val">
                                        {value.toLocaleString()} taps
                                        {point.weather && ` ${getWeatherEmoji(point.weather.weatherCode)}`}
                                        {point.isProtestDay && ' (PROTEST DAY)'}
                                    </span>,
                                    ''
                                ]
                            }
                            return null
                        }}
                        labelFormatter={(label: any, items: readonly any[]) => {
                            const point = items[0]?.payload
                            if (point) {
                                return `${protestDayOfWeek}, ${label}`
                            }
                            return String(label)
                        }}
                    />
                </AreaChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-green-500"></div>
                    <span>Mean</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-yellow-500" style={{ borderStyle: 'dashed' }}></div>
                    <span>±1σ</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Protest Day</span>
                </div>
            </div>
        </div>
    )
}

function formatDateShort(date: Date): string {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
