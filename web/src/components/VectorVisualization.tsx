import { useState, useEffect } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Network, DatabaseZap, Fingerprint } from 'lucide-react'
import { DeckGL } from '@deck.gl/react'
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers'
import { Matrix } from 'ml-matrix'

interface VectorChunk {
  id: string
  name: string
  filePath: string
  purpose: string
  semanticType: string
  complexity: { score: number; level: string }
  embedding?: number[]
}

const semanticTypeColors: Record<string, [number, number, number]> = {
  function: [59, 130, 246],
  method_definition: [16, 185, 129],
  arrow_function: [245, 158, 11],
  react_component: [236, 72, 153],
  unknown: [156, 163, 175],
}

export function VectorVisualization() {
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState<any[]>([])
  const [networkData, setNetworkData] = useState<{nodes: any[], edges: any[]}>({nodes: [], edges: []})
  const [tooltip, setTooltip] = useState<any>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [chunksRes, networkRes] = await Promise.all([
        fetch('http://localhost:3333/api/semantic-chunks'),
        fetch('http://localhost:3333/api/vector-db/network')
      ])

      if (chunksRes.ok && networkRes.ok) {
        const chunksData = await chunksRes.json()
        const network = await networkRes.json()
        
        const chunks = chunksData.chunks.filter((c: any) => c.embedding)
        if (chunks.length > 1) {
          const matrix = new Matrix(chunks.map((c: any) => c.embedding))
          const { V } = (matrix.subRowVector(matrix.mean('column')) as any).svd()
          const projected = matrix.mmul((V as any).getColumn(0).augment((V as any).getColumn(1)) as any)
          
          setPoints(chunks.map((c: any, i: number) => ({
            ...c,
            x: projected.get(i, 0),
            y: projected.get(i, 1)
          })))
        }
        setNetworkData(network)
      }
    } catch (e) {
      console.error('Failed to fetch semantic data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const getLayers = () => {
    return [
      new ScatterplotLayer({
        id: 'semantic-points',
        data: points,
        getPosition: (d: any) => [d.x * 10, d.y * 10], // Simple scale
        getRadius: (d: any) => Math.max(2, (d.complexity?.score || 1) * 0.5),
        getFillColor: (d: any) => semanticTypeColors[d.semanticType] || semanticTypeColors.unknown,
        pickable: true,
        onHover: (info: any) => setTooltip(info.object ? { object: info.object, x: info.x, y: info.y } : null)
      })
    ]
  }

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
          <Badge variant="outline" className="border-vesper font-thin text-[10px] uppercase tracking-widest">
            <DatabaseZap className="w-3 h-3 mr-1" />
            SQLite Persistence Active
          </Badge>
        </div>
      </header>

      <Card className="border-vesper bg-vesper-card overflow-hidden">
        <div className="relative w-full h-[500px]">
          <DeckGL
            initialViewState={{ longitude: 0, latitude: 0, zoom: 5 } as any}
            controller={true}
            layers={getLayers()}
            width="100%"
            height="100%"
          />
          
          {tooltip && (
            <div className="absolute z-50 bg-background/95 border border-vesper p-3 rounded shadow-xl pointer-events-none"
                 style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}>
              <div className="flex items-center gap-2 mb-1">
                <Fingerprint className="w-3 h-3 text-vesper-accent" />
                <span className="text-xs font-bold color-vesper-fg">{tooltip.object.name}</span>
              </div>
              <div className="text-[10px] color-vesper-muted mono mb-2">{tooltip.object.filePath}</div>
              <div className="text-[11px] color-vesper-fg line-clamp-2 max-w-[250px]">{tooltip.object.purpose}</div>
              <div className="mt-2 flex gap-2">
                <Badge variant="outline" className="text-[9px] border-vesper">{tooltip.object.semanticType}</Badge>
                <Badge variant="outline" className="text-[9px] border-vesper">Complexity: {tooltip.object.complexity?.score}</Badge>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(semanticTypeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 p-2 border border-vesper rounded bg-vesper-card/50">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `rgb(${color.join(',')})` }} />
            <span className="text-[10px] uppercase tracking-widest font-thin">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
