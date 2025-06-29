import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Network, RefreshCw, DatabaseZap, GitBranch, BarChart3, Settings, Download } from 'lucide-react'
import { MultiSelect } from './ui/multi-select'
import { DeckGL } from '@deck.gl/react'
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers'
import { Matrix } from 'ml-matrix'

interface VectorChunk {
  id: string
  similarity?: number
  embedding?: number[]
  metadata: {
    content: string
    semanticType: string
    businessDomain: string[]
    technicalPatterns: string[]
    purpose: string
    files: string[]
    size: number
    complexity: number | { score: number; level: string }
  }
}

interface ClusterPoint {
  id: string
  x: number
  y: number
  cluster: number
  chunk: VectorChunk
  semanticType: string
  complexity: number
}

interface NetworkNode {
  id: string
  chunk: VectorChunk
  x: number
  y: number
  color: [number, number, number]
}

interface NetworkEdge {
  source: [number, number]
  target: [number, number]
  similarity: number
}

interface VectorStats {
  totalChunks: number
  collectionName: string
  modelName: string
}

interface TooltipInfo {
  object: any
  x: number
  y: number
}

const semanticTypeColors: Record<string, [number, number, number]> = {
  ui_component: [59, 130, 246],
  page_component: [16, 185, 129],
  layout_component: [245, 158, 11],
  modal_component: [239, 68, 68],
  form_component: [168, 85, 247],
  hook: [236, 72, 153],
  context: [14, 165, 233],
  state_management: [34, 197, 94],
  api_integration: [251, 146, 60],
  data_model: [139, 92, 246],
  utility: [107, 114, 128],
  configuration: [75, 85, 99],
  styling: [244, 63, 94],
  testing: [16, 185, 129],
  documentation: [59, 130, 246],
  error_handling: [239, 68, 68],
  performance: [245, 158, 11],
  security: [220, 38, 127],
  monitoring: [99, 102, 241],
  type_definition: [147, 51, 234],
  business_logic: [37, 99, 235],
  algorithm: [29, 78, 216],
  unknown: [156, 163, 175],
}

export function VectorVisualization() {
  const [stats, setStats] = useState<VectorStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [searchResults, setSearchResults] = useState<VectorChunk[]>([])
  const [allChunks, setAllChunks] = useState<VectorChunk[]>([])
  const [clusterData, setClusterData] = useState<ClusterPoint[]>([])
  const [selectedChunk, setSelectedChunk] = useState<VectorChunk | null>(null)
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([])
  const [networkEdges, setNetworkEdges] = useState<NetworkEdge[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [clusterTooltip, setClusterTooltip] = useState<TooltipInfo | null>(null)
  const [networkTooltip, setNetworkTooltip] = useState<TooltipInfo | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([])

  const clusterContainerRef = useRef<HTMLDivElement>(null)
  const networkContainerRef = useRef<HTMLDivElement>(null)

  const fetchVectorStats = async (forceRefresh = false) => {
    setLoading(true)
    try {
      const chunksUrl = forceRefresh
        ? 'http://localhost:3333/api/semantic-chunks?refresh=true'
        : 'http://localhost:3333/api/semantic-chunks'

      const [statsResponse, chunksResponse] = await Promise.all([
        fetch('http://localhost:3333/api/vector-db/status'),
        fetch(chunksUrl)
      ])

      if (statsResponse.ok) {
        const data = await statsResponse.json()
        setStats(data.stats)
      }

      if (chunksResponse.ok) {
        const chunksData = await chunksResponse.json()
        console.log('📊 Received chunks data:', {
          hasChunks: !!chunksData.chunks,
          chunksLength: chunksData.chunks?.length,
          sampleChunk: chunksData.chunks?.[0] ? {
            name: chunksData.chunks[0].name,
            hasEmbedding: !!chunksData.chunks[0].embedding,
            hasMetadata: !!chunksData.chunks[0].metadata,
            semanticType: chunksData.chunks[0].semanticType
          } : null
        })

        if (chunksData.chunks && Array.isArray(chunksData.chunks)) {
          const vectorChunks: VectorChunk[] = chunksData.chunks.map((chunk: Record<string, unknown>) => ({
            id: chunk.name as string || chunk.id as string,
            embedding: chunk.embedding as number[] | undefined,
            metadata: (chunk.metadata as VectorChunk['metadata']) || {
              content: chunk.code as string || '',
              semanticType: chunk.semanticType as string || 'unknown',
              businessDomain: chunk.businessDomain as string[] || [],
              technicalPatterns: chunk.technicalPatterns as string[] || [],
              purpose: chunk.purpose as string || '',
              files: (chunk.files as string[]) || [chunk.filePath as string].filter(Boolean),
              size: chunk.size as number || 0,
              complexity: chunk.complexity as number || 0
            }
          }))

          console.log('📊 Processed vector chunks:', {
            count: vectorChunks.length,
            withEmbeddings: vectorChunks.filter(c => c.embedding).length,
            sampleMetadata: vectorChunks[0]?.metadata
          })

          setAllChunks(vectorChunks)
          await generateClusterData(vectorChunks)
        }
      }
    } catch (error) {
      console.error('Error fetching vector stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateClusterData = async (chunks: VectorChunk[]) => {
    if (!chunks.length) {
      console.log('📊 No chunks to generate cluster data from')
      return
    }

    console.log('📊 Generating cluster data for', chunks.length, 'chunks')
    const chunksWithEmbeddings = chunks.filter(c => c.embedding && c.embedding.length > 0)
    console.log('📊 Chunks with embeddings:', chunksWithEmbeddings.length)

    const semanticTypeMap: Record<string, number> = {
      'business_logic': 0,
      'algorithm': 0,
      'data_processing': 1,
      'database': 1,
      'api_integration': 2,
      'middleware': 2,
      'routing': 2,
      'ui_component': 3,
      'page_component': 3,
      'layout_component': 3,
      'hook': 3,
      'utility': 4,
      'configuration': 4,
      'testing': 5,
      'documentation': 5,
      'monitoring': 5,
      'error_handling': 6,
      'performance': 6,
      'security': 6,
      'function': 4,
      'async_function': 2,
      'api_function': 2,
      'react_component': 3,
      'react_hook_component': 3,
      'react_functional_component': 3,
      'class': 0,
      'data_class': 1,
      'error_class': 6,
      'type_definition': 4,
      'component_types': 4,
      'config_types': 4,
      'constant': 4,
      'import_export': 4,
      'unknown': 7
    }

    let points: ClusterPoint[] = []

    if (chunksWithEmbeddings.length > 1) {
      try {
        const embeddingMatrix = new Matrix(chunksWithEmbeddings.map(c => c.embedding!))
        console.log('📊 Embedding matrix shape:', embeddingMatrix.rows, 'x', embeddingMatrix.columns)

        const means = embeddingMatrix.mean('column')
        const centeredMatrix = embeddingMatrix.subRowVector(means)

        // @ts-expect-error: ml-matrix svd/augment methods may not be fully typed
        const { V } = centeredMatrix.svd()
        const pc1 = V.getColumn(0)
        const pc2 = V.getColumn(1)
        // @ts-expect-error: ml-matrix augment method may not be fully typed
        const projected = centeredMatrix.mmul(Matrix.columnVector(pc1).augment(Matrix.columnVector(pc2)))

        console.log('📊 PCA projection completed')

        points = chunksWithEmbeddings.map((chunk, idx) => {
          const cluster = semanticTypeMap[chunk.metadata.semanticType] ?? 5
          const complexity = typeof chunk.metadata.complexity === 'object'
            ? chunk.metadata.complexity.score
            : (chunk.metadata.complexity || 0)

          return {
            id: chunk.id,
            x: projected.get(idx, 0),
            y: projected.get(idx, 1),
            cluster,
            chunk,
            semanticType: chunk.metadata.semanticType,
            complexity
          }
        })

      } catch (error) {
        console.warn('📊 PCA failed, falling back to simple projection:', error)
        points = chunksWithEmbeddings.map((chunk) => {
          const cluster = semanticTypeMap[chunk.metadata.semanticType] ?? 5
          const complexity = typeof chunk.metadata.complexity === 'object'
            ? chunk.metadata.complexity.score
            : (chunk.metadata.complexity || 0)

          return {
            id: chunk.id,
            x: chunk.embedding![0] || 0,
            y: chunk.embedding![1] || 0,
            cluster,
            chunk,
            semanticType: chunk.metadata.semanticType,
            complexity
          }
        })
      }
    } else {
      points = chunks.map((chunk) => {
        const cluster = semanticTypeMap[chunk.metadata.semanticType] ?? 5
        const complexity = typeof chunk.metadata.complexity === 'object'
          ? chunk.metadata.complexity.score
          : (chunk.metadata.complexity || 0)

        return {
          id: chunk.id,
          x: chunk.embedding?.[0] || Math.random(),
          y: chunk.embedding?.[1] || Math.random(),
          cluster,
          chunk,
          semanticType: chunk.metadata.semanticType,
          complexity
        }
      })
    }

    console.log('📊 Generated cluster points:', points.length)


    // Calculate bounds and log for debugging
    if (points.length > 0) {
      const xValues = points.map(p => p.x)
      const yValues = points.map(p => p.y)
      const bounds = {
        minX: Math.min(...xValues),
        maxX: Math.max(...xValues),
        minY: Math.min(...yValues),
        maxY: Math.max(...yValues),
        rangeX: Math.max(...xValues) - Math.min(...xValues),
        rangeY: Math.max(...yValues) - Math.min(...yValues)
      }
      console.log('📊 Data bounds:', bounds)

      // Normalize coordinates to fit roughly in [-100, 100] range for deck.gl
      const scale = 200 / Math.max(bounds.rangeX, bounds.rangeY)
      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2

      points = points.map(p => ({
        ...p,
        x: (p.x - centerX) * scale,
        y: (p.y - centerY) * scale
      }))

      console.log('📊 Normalized points to [-100, 100] range with scale:', scale)
    }

    setClusterData(points)

    if (chunksWithEmbeddings.length > 0) {
      generateNetworkData(chunks)
    }
  }

  const generateNetworkData = async (chunks: VectorChunk[]) => {
    if (chunks.length === 0) return

    console.log('📊 Generating network data for', chunks.length, 'chunks')

    // Use cluster data positions if available, otherwise create new positions
    const nodes: NetworkNode[] = chunks.slice(0, 50).map((chunk, idx) => {
      const clusterPoint = clusterData.find(p => p.chunk.id === chunk.id)
      return {
        id: chunk.id,
        chunk,
        x: clusterPoint?.x || (Math.random() - 0.5) * 200,
        y: clusterPoint?.y || (Math.random() - 0.5) * 200,
        color: semanticTypeColors[chunk.metadata.semanticType] || semanticTypeColors.unknown
      }
    })

    console.log('📊 Created', nodes.length, 'network nodes')

    const edges: NetworkEdge[] = []
    const similarityThreshold = 0.3

    for (let i = 0; i < Math.min(nodes.length, 20); i++) {
      try {
        const response = await fetch('http://localhost:3333/api/vector-db/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: nodes[i].chunk.metadata.content.slice(0, 200),
            limit: 10,
            minSimilarity: similarityThreshold
          })
        })

        if (response.ok) {
          const data = await response.json()
          const results = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []

          results.forEach((result: VectorChunk) => {
            const targetNodeIdx = nodes.findIndex(n => n.id === result.id)
            if (targetNodeIdx !== -1 && result.id !== nodes[i].id && result.similarity && result.similarity >= similarityThreshold) {
              edges.push({
                source: [nodes[i].x, nodes[i].y],
                target: [nodes[targetNodeIdx].x, nodes[targetNodeIdx].y],
                similarity: result.similarity
              })
            }
          })
        }
      } catch (error) {
        console.error('Error generating network data:', error)
      }
    }

    setNetworkNodes(nodes)
    setNetworkEdges(edges)
  }

  const findSimilarChunks = async (chunk: VectorChunk) => {
    if (!chunk.metadata.content) return

    setSelectedChunk(chunk)
    try {
      const response = await fetch('http://localhost:3333/api/vector-db/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: chunk.metadata.content.slice(0, 200),
          limit: 20,
          minSimilarity: 0.3
        })
      })

      if (response.ok) {
        const data = await response.json()
        const results = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []
        setSearchResults(results.filter((r: VectorChunk) => r.id !== chunk.id))
      }
    } catch (error) {
      console.error('Error finding similar chunks:', error)
    }
  }

  const rebuildVectorDB = async () => {
    setRebuilding(true)
    try {
      const response = await fetch('http://localhost:3333/api/vector-db/rebuild', {
        method: 'POST'
      })
      if (response.ok) {
        await fetchVectorStats()
      }
    } catch (error) {
      console.error('Error rebuilding vector DB:', error)
    } finally {
      setRebuilding(false)
    }
  }


  const getUniqueTypes = () => {
    const types = [...new Set(clusterData.map(p => p.semanticType))]
    return types.map(type => ({
      label: type.replace(/_/g, ' '),
      value: type,
      color: `rgb(${semanticTypeColors[type]?.join(',') || '156,163,175'})`
    }))
  }

  const getUniquePurposes = () => {
    const purposes = [...new Set(clusterData.map(p => p.chunk.metadata.purpose).filter(Boolean))]
    return purposes.map(purpose => ({
      label: purpose,
      value: purpose
    }))
  }

  const getFilteredClusterData = () => {
    return clusterData.filter(point => {
      const typeMatch = selectedTypes.length === 0 || selectedTypes.includes(point.semanticType)
      const purposeMatch = selectedPurposes.length === 0 ||
        selectedPurposes.some(purpose =>
          point.chunk.metadata.purpose.toLowerCase().includes(purpose.toLowerCase())
        )
      return typeMatch && purposeMatch
    })
  }

  const getClusterLayer = () => {
    const filteredData = getFilteredClusterData()
    return new ScatterplotLayer({
      id: 'cluster-layer',
      data: filteredData,
      getPosition: (d: ClusterPoint) => [d.x, d.y, 0],
      getRadius: (d: ClusterPoint) => Math.max(5, Math.min(25, d.complexity * 1.5 + 5)),
      radiusUnits: 'pixels',
      getFillColor: (d: ClusterPoint) => semanticTypeColors[d.semanticType] || semanticTypeColors.unknown,
      pickable: true,
      onHover: (info: any) => {
        if (info.object) {
          setClusterTooltip({
            object: info.object,
            x: info.x,
            y: info.y
          })
        } else {
          setClusterTooltip(null)
        }
      },
      onClick: (info: any) => {
        if (info.object) {
          findSimilarChunks(info.object.chunk)
        }
      }
    })
  }

  const getNetworkLayers = () => {
    console.log('📊 Creating network layers with', networkNodes.length, 'nodes and', networkEdges.length, 'edges')

    const nodeLayer = new ScatterplotLayer({
      id: 'network-nodes',
      data: networkNodes,
      getPosition: (d: NetworkNode) => [d.x, d.y, 0],
      getRadius: 12,
      radiusUnits: 'pixels',
      getFillColor: (d: NetworkNode) => d.color,
      pickable: true,
      onHover: (info: any) => {
        if (info.object) {
          setNetworkTooltip({
            object: info.object,
            x: info.x,
            y: info.y
          })
        } else {
          setNetworkTooltip(null)
        }
      },
      onClick: (info: any) => {
        if (info.object) {
          findSimilarChunks(info.object.chunk)
        }
      }
    })

    const edgeLayer = new ArcLayer({
      id: 'network-edges',
      data: networkEdges,
      getSourcePosition: (d: NetworkEdge) => [...d.source, 0],
      getTargetPosition: (d: NetworkEdge) => [...d.target, 0],
      getWidth: (d: NetworkEdge) => Math.max(2, d.similarity * 8),
      widthUnits: 'pixels',
      getSourceColor: [120, 120, 120, 180],
      getTargetColor: [120, 120, 120, 180]
    })

    return [edgeLayer, nodeLayer]
  }

  const exportVisualization = (format: 'png' | 'svg') => {
    if (!clusterContainerRef.current) return

    const canvas = clusterContainerRef.current.querySelector('canvas')
    if (!canvas) return

    if (format === 'png') {
      const link = document.createElement('a')
      link.download = `semantic-clusters-${Date.now()}.png`
      link.href = canvas.toDataURL()
      link.click()
    }
  }

  useEffect(() => {
    fetchVectorStats()
  }, [])

  useEffect(() => {
    if (activeTab !== 'overview' && allChunks.length === 0) {
      fetchVectorStats()
    }
  }, [activeTab, allChunks.length])

  useEffect(() => {
    if (stats && allChunks.length === 0) {
      console.log('📊 Stats available but no chunks loaded, fetching chunks...')
      fetchVectorStats()
    }
  }, [stats, allChunks.length])

  const renderClusterTooltip = () => {
    if (!clusterTooltip) return null

    const data = clusterTooltip.object
    const chunk = data.chunk

    return (
      <div
        className="absolute z-50 bg-background border rounded-lg shadow-lg px-4 py-3 text-sm pointer-events-none"
        style={{
          left: clusterTooltip.x + 12,
          top: clusterTooltip.y + 12,
          minWidth: 220,
          maxWidth: 400,
        }}
      >
        <div className="font-thin">{chunk.id}</div>
        <div>Type: {chunk.metadata.semanticType}</div>
        <div>Purpose: {chunk.metadata.purpose}</div>
        <div>File: {chunk.metadata.files?.[0]?.split('/').slice(-2).join('/') || 'Unknown'}</div>
        <div>
          Complexity: {
            typeof chunk.metadata.complexity === 'object'
              ? `${chunk.metadata.complexity.score} (${chunk.metadata.complexity.level})`
              : chunk.metadata.complexity
          }
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {chunk.metadata.content.slice(0, 100)}...
        </div>
      </div>
    )
  }

  const renderNetworkTooltip = () => {
    if (!networkTooltip) return null

    const data = networkTooltip.object
    const chunk = data.chunk

    return (
      <div
        className="absolute z-50 bg-background border rounded-lg shadow-lg px-4 py-3 text-sm pointer-events-none"
        style={{
          left: networkTooltip.x + 12,
          top: networkTooltip.y + 12,
          minWidth: 220,
          maxWidth: 400,
        }}
      >
        <div className="font-thin">{chunk.id}</div>
        <div>Type: {chunk.metadata.semanticType}</div>
        <div>Purpose: {chunk.metadata.purpose}</div>
        <div>File: {chunk.metadata.files?.[0]?.split('/').slice(-2).join('/') || 'Unknown'}</div>
        <div>
          Complexity: {
            typeof chunk.metadata.complexity === 'object'
              ? `${chunk.metadata.complexity.score} (${chunk.metadata.complexity.level})`
              : chunk.metadata.complexity
          }
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {chunk.metadata.content.slice(0, 100)}...
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5" />
            Vector Database Explorer
          </CardTitle>
          <CardDescription>
            Explore your codebase through semantic similarity and visual analysis
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="clusters" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Clusters
          </TabsTrigger>
          <TabsTrigger value="network" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Network
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Status</CardTitle>
              <CardDescription>
                Vector database status and management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Button
                  onClick={() => fetchVectorStats(true)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  onClick={rebuildVectorDB}
                  disabled={rebuilding}
                  variant="outline"
                  size="sm"
                >
                  <DatabaseZap className={`w-4 h-4 mr-2 ${rebuilding ? 'animate-spin' : ''}`} />
                  Rebuild Vector DB
                </Button>
                {stats && (
                  <Badge variant="secondary">
                    {stats.totalChunks} chunks indexed
                  </Badge>
                )}
              </div>

              {!stats && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Network className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No vector DB data available</p>
                  <p className="text-sm">Run a rebuild to see stats</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
                  <p>Loading vector DB status...</p>
                </div>
              )}

              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-thin">{stats.totalChunks}</div>
                    <div className="text-sm text-muted-foreground">Total Chunks</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-thin">{stats.collectionName}</div>
                    <div className="text-sm text-muted-foreground">Collection</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-thin">{stats.modelName}</div>
                    <div className="text-sm text-muted-foreground">Model</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="clusters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Semantic Code Clusters
              </CardTitle>
              <CardDescription>
                2D projection of code chunks by semantic similarity. Click points to explore.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clusterData.length > 0 ? (
                <>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/30 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchVectorStats(true)}
                            disabled={loading}
                          >
                            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            Refresh Data
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportVisualization('png')}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Export PNG
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={rebuildVectorDB}
                            disabled={rebuilding}
                          >
                            <DatabaseZap className={`w-4 h-4 mr-1 ${rebuilding ? 'animate-spin' : ''}`} />
                            Rebuild
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                          <label className="text-xs font-thin">Semantic Types</label>
                          <MultiSelect
                            options={getUniqueTypes()}
                            selected={selectedTypes}
                            onSelectedChange={setSelectedTypes}
                            placeholder="All types"
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-thin">Purposes</label>
                          <MultiSelect
                            options={getUniquePurposes()}
                            selected={selectedPurposes}
                            onSelectedChange={setSelectedPurposes}
                            placeholder="All purposes"
                            className="w-full"
                          />
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Showing {getFilteredClusterData().length} of {clusterData.length} points
                        </div>
                      </div>
                    </div>
                  </div>

                  <div ref={clusterContainerRef} className="relative w-full h-[600px] border rounded-lg">
                    <DeckGL
                      initialViewState={{
                        longitude: 0,
                        latitude: 0,
                        zoom: 4
                      } as any}
                      controller={true}
                      layers={[getClusterLayer()]}
                      width="100%"
                      height="100%"
                    />
                    {renderClusterTooltip()}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/30 rounded-lg border">
                        <div className="text-sm font-thin mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                          Visualization Features
                        </div>
                        <div className="text-xs text-muted-foreground space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="w-1 h-1 bg-muted-foreground rounded-full mt-1.5 flex-shrink-0"></div>
                            <span><strong>PCA Dimensionality Reduction:</strong> Mathematical projection from high-dimensional embeddings</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1 h-1 bg-muted-foreground rounded-full mt-1.5 flex-shrink-0"></div>
                            <span><strong>Interactive Controls:</strong> Mouse wheel zoom, drag to pan</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-1 h-1 bg-muted-foreground rounded-full mt-1.5 flex-shrink-0"></div>
                            <span><strong>Click to Explore:</strong> Click points to find similar chunks</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/30 rounded-lg border">
                        <div className="text-sm font-thin mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-chart-1 rounded-full"></div>
                          Color Legend
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {(() => {
                            const uniqueTypes = [...new Set(clusterData.map(p => p.semanticType))]
                            if (uniqueTypes.length === 0) {
                              return <div>No types found</div>
                            }
                            return uniqueTypes.map(type => (
                              <div key={type} className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full border border-border/50"
                                  style={{
                                    backgroundColor: `rgb(${semanticTypeColors[type]?.join(',') || '156,163,175'})`
                                  }}
                                />
                                <span className="text-muted-foreground">{type.replace(/_/g, ' ')}</span>
                              </div>
                            ))
                          })()}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="text-xs text-muted-foreground">
                            <strong>Point Size:</strong> Represents code complexity
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No clustering data available</p>
                  <p className="text-sm">Go to Overview tab and refresh to load chunk embeddings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Semantic Network Graph
              </CardTitle>
              <CardDescription>
                Network graph showing connections between similar code chunks. Click nodes to explore.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {networkNodes.length > 0 ? (
                <div ref={networkContainerRef} className="relative w-full h-[600px] border rounded-lg">
                  <DeckGL
                    initialViewState={{
                      longitude: 0,
                      latitude: 0,
                      zoom: 4
                    } as any}
                    controller={true}
                    layers={getNetworkLayers()}
                    width="100%"
                    height="100%"
                  />
                  {renderNetworkTooltip()}
                  <div className="absolute bottom-4 left-4 text-sm text-muted-foreground bg-background/90 p-2 rounded">
                    <p>• <strong>Click</strong> nodes to find similar chunks</p>
                    <p>• <strong>Line thickness</strong> shows similarity strength</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Building network graph...</p>
                  <p className="text-sm">This may take a moment as we calculate similarities</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
