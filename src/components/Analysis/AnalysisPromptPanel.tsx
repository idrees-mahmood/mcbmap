/**
 * Analysis Prompt Panel
 * =====================
 * Displays a generated LLM prompt for unbiased analysis of protest impact.
 * Allows users to copy the prompt for use with ChatGPT, Claude, etc.
 */

import { useState, useEffect, useCallback } from 'react'
import type { ProtestWithRoute } from '../../lib/database.types'
import type { BusinessWithStatus } from '../../lib/businessStatusHelper'
import { logAndGeneratePrompt, generateAnalysisSummary } from '../../lib/llmPromptGenerator'

interface Props {
    protest: ProtestWithRoute
    businesses: BusinessWithStatus[]
}

export function AnalysisPromptPanel({ protest, businesses }: Props) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [prompt, setPrompt] = useState('')
    const [copied, setCopied] = useState(false)

    // Generate prompt when businesses change
    useEffect(() => {
        if (businesses.length > 0) {
            const generatedPrompt = logAndGeneratePrompt(protest, businesses)
            setPrompt(generatedPrompt)
        }
    }, [protest, businesses])

    // Copy to clipboard
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(prompt)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (e) {
            console.error('Failed to copy:', e)
        }
    }, [prompt])

    // Get summary stats for preview
    const summary = businesses.length > 0
        ? generateAnalysisSummary(protest, businesses).summary
        : null

    if (!summary || summary.total === 0) {
        return null
    }

    return (
        <div className="border border-slate-700 rounded-xl overflow-hidden mt-3">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between bg-gradient-to-r from-indigo-900/50 to-purple-900/50 hover:from-indigo-800/50 hover:to-purple-800/50 transition-colors"
            >
                <span className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    🤖 LLM Analysis Prompt
                </span>
                <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="p-4 bg-slate-900/50 space-y-4">
                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                            <div className="text-slate-400">Total POIs</div>
                            <div className="text-lg font-bold text-white">{summary.total.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                            <div className="text-slate-400">Would Be Open</div>
                            <div className="text-lg font-bold text-green-400">
                                {(summary.open + summary.partiallyOpen).toLocaleString()}
                                <span className="text-xs text-slate-500 ml-1">
                                    ({summary.total > 0 ? ((summary.open + summary.partiallyOpen) / summary.total * 100).toFixed(0) : 0}%)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="text-xs text-slate-400">
                        <p className="mb-2">
                            This prompt is designed for <strong className="text-slate-300">unbiased, evidence-based analysis</strong> of
                            protest commercial impact. Use it with ChatGPT, Claude, or similar LLMs.
                        </p>
                        <p className="text-slate-500 italic">
                            Context: Legal experts argue the Met Police are using outdated powers. This data helps assess
                            claims of "serious disruption."
                        </p>
                    </div>

                    {/* Prompt preview */}
                    <div className="relative">
                        <pre className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
                            {prompt.slice(0, 500)}...
                        </pre>

                        {/* Copy button */}
                        <button
                            onClick={handleCopy}
                            className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied
                                    ? 'bg-green-600 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                }`}
                        >
                            {copied ? '✓ Copied!' : '📋 Copy Full Prompt'}
                        </button>
                    </div>

                    {/* Usage hint */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>💡</span>
                        <span>Full prompt (~{prompt.length.toLocaleString()} chars) includes analysis questions and data tables</span>
                    </div>
                </div>
            )}
        </div>
    )
}
