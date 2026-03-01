import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Network, DatabaseZap, Fingerprint, RotateCw } from 'lucide-react'
import * as d3 from 'd3'

interface ProjectionPoint {
  id: string
  x: number
  y: number
  name: string
  filePath: string
  purpose: string
  semanticType: string
  complexity: number
  directory: string
}

interface ProjectionResponse {
  points: ProjectionPoint[]
  meta: {
    totalPoints: number
    embeddingCount: number
    computedAt: string | null
    cached: boolean
  }
}

// Map purpose values to CSS variable names
const purposeColorVar = (purpose: string): string => {
  const key = purpose.toLowerCase().replace(/\s+/g, '_')
  return `var(--color-semantic-${key}, var(--color-semantic-unknown))`
}

// All known purpose categories for the legend
const PURPOSE_CATEGORIES = [
  'ui_component', 'page_component', 'layout_component', 'modal_component',
  'form_component', 'hook', 'context', 'state_management', 'api_integration',
  'data_model', 'utility', 'configuration', 'styling', 'testing',
  'documentation', 'error_handling', 'performance', 'security', 'monitoring',
  'type_definition', 'business_logic', 'algorithm', 'unknown'
]

export function VectorVisualization() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProjectionResponse | null>(null)
  const [tooltip, setTooltip] = useState<{ point: ProjectionPoint; x: number; y: number } | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<ProjectionPoint | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vector-db/projection')
      if (res.ok) {
        const json: ProjectionResponse = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error('Failed to fetch projection data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch code when a point is selected
  useEffect(() => {
    if (!selectedPoint) { setSelectedCode(null); return }
    fetch(`/api/files/${selectedPoint.filePath}`)
      .then(r => r.ok ? r.text() : null)
      .then(text => setSelectedCode(text))
      .catch(() => setSelectedCode(null))
  }, [selectedPoint])

  // D3 rendering
  useEffect(() => {
    if (!data || data.points.length === 0 || !svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = containerRef.current
    const width = container.clientWidth
    const height = 500

    svg.attr('width', width).attr('height', height)

    const points = data.points

    // Scales
    const xExtent = d3.extent(points, d => d.x) as [number, number]
    const yExtent = d3.extent(points, d => d.y) as [number, number]
    const padding = 40

    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.05, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.05])
      .range([padding, width - padding])

    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.05, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.05])
      .range([height - padding, padding])

    const rScale = d3.scaleSqrt()
      .domain([0, d3.max(points, d => d.complexity) || 1])
      .range([3, 12])

    // Zoom container
    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Directory labels at centroids
    const dirGroups = d3.group(points, d => d.directory)
    dirGroups.forEach((dirPoints, dir) => {
      if (dirPoints.length < 2 || dir === '.') return
      const cx = d3.mean(dirPoints, d => xScale(d.x))!
      const cy = d3.mean(dirPoints, d => yScale(d.y))!
      g.append('text')
        .attr('x', cx)
        .attr('y', cy)
        .attr('text-anchor', 'middle')
        .attr('class', 'fill-muted-foreground/40')
        .style('font-size', '9px')
        .style('font-weight', '300')
        .style('letter-spacing', '0.05em')
        .style('text-transform', 'uppercase')
        .style('pointer-events', 'none')
        .text(dir.split('/').pop() || dir)
    })

    // Draw circles
    g.selectAll('circle')
      .data(points)
      .join('circle')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', d => rScale(d.complexity))
      .attr('fill', d => purposeColorVar(d.purpose))
      .attr('opacity', 0.75)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', 'var(--foreground)')
        const rect = container.getBoundingClientRect()
        setTooltip({
          point: d,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        })
      })
      .on('mousemove', function (event) {
        const rect = container.getBoundingClientRect()
        setTooltip(prev => prev ? {
          ...prev,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        } : null)
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.75).attr('stroke', 'transparent')
        setTooltip(null)
      })
      .on('click', function (_event, d) {
        setSelectedPoint(prev => prev?.id === d.id ? null : d)
      })

  }, [data])

  // Get visible purpose categories (ones that actually exist in data)
  const visiblePurposes = data ? (() => {
    const counts = new Map<string, number>()
    for (const p of data.points) {
      const key = p.purpose.toLowerCase().replace(/\s+/g, '_')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return PURPOSE_CATEGORIES
      .filter(cat => counts.has(cat))
      .map(cat => ({ category: cat, count: counts.get(cat)! }))
  })() : []

  const isEmpty = !loading && (!data || data.points.length === 0)

  return (
    <div className="w-full space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-thin tracking-tight flex items-center gap-2">
            <Network className="w-4 h-4 text-vesper-accent" />
            Semantic Landscape
          </h1>
          <p className="text-xs text-muted-foreground font-thin">Visualizing the code's conceptual clusters</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.meta.cached && (
            <Badge variant="outline" className="border-vesper font-thin text-[10px] uppercase tracking-widest">
              cached
            </Badge>
          )}
          <Badge variant="outline" className="border-vesper font-thin text-[10px] uppercase tracking-widest">
            <DatabaseZap className="w-3 h-3 mr-1" />
            {data?.meta.totalPoints || 0} points
          </Badge>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded border border-vesper hover:bg-vesper-card/80 transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <Card className="border-vesper bg-vesper-card overflow-hidden">
        <div ref={containerRef} className="relative w-full h-[500px]">
          {isEmpty ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
                <Network className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground font-thin">
                  No vector embeddings found. Embeddings are generated automatically during{' '}
                  <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">cntx-ui watch</code>{' '}
                  when semantic analysis runs.
                </p>
                <p className="text-xs text-muted-foreground/60 font-thin">
                  Start the watcher in your project directory and wait for the initial analysis to complete.
                </p>
              </div>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full" />
          )}

          {tooltip && (
            <div
              className="absolute z-50 bg-background/95 border border-vesper p-3 rounded shadow-xl pointer-events-none"
              style={{
                left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 400) - 280),
                top: Math.min(tooltip.y + 12, 400)
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Fingerprint className="w-3 h-3 text-vesper-accent" />
                <span className="text-xs font-bold">{tooltip.point.name}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mb-2">{tooltip.point.filePath}</div>
              <div className="text-[11px] line-clamp-2 max-w-[250px]">{tooltip.point.purpose}</div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-[9px] border-vesper">{tooltip.point.semanticType}</Badge>
                <Badge variant="outline" className="text-[9px] border-vesper">Complexity: {tooltip.point.complexity}</Badge>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Network className="w-8 h-8 animate-pulse text-vesper-accent" />
                <span className="text-xs font-thin tracking-widest uppercase">Projecting Intelligence...</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Selected point detail panel */}
      {selectedPoint && (
        <Card className="border-vesper bg-vesper-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-vesper-accent" />
              <span className="text-sm font-medium">{selectedPoint.name}</span>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              close
            </button>
          </div>
          <div className="text-xs text-muted-foreground font-mono mb-2">{selectedPoint.filePath}</div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <Badge variant="outline" className="text-[9px] border-vesper">{selectedPoint.semanticType}</Badge>
            <Badge variant="outline" className="text-[9px] border-vesper">{selectedPoint.purpose}</Badge>
            <Badge variant="outline" className="text-[9px] border-vesper">Complexity: {selectedPoint.complexity}</Badge>
          </div>
          {selectedCode && (
            <pre className="text-[11px] font-mono bg-muted/30 rounded p-3 overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed">
              {selectedCode.split('\n').slice(0, 80).join('\n')}
              {(selectedCode.split('\n').length > 80) && '\n... (truncated)'}
            </pre>
          )}
        </Card>
      )}

      {/* Legend */}
      {visiblePurposes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visiblePurposes.map(({ category, count }) => (
            <div
              key={category}
              className="flex items-center gap-1.5 px-2 py-1 border border-vesper rounded bg-vesper-card/50"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: `var(--color-semantic-${category})` }}
              />
              <span className="text-[10px] uppercase tracking-widest font-thin">
                {category.replace(/_/g, ' ')}
              </span>
              <span className="text-[9px] text-muted-foreground">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
