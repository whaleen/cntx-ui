import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import {
  Copy,
  RefreshCw,
  Zap,
  FileText,
  Code,
  Package,
  AlertTriangle,
  Eye,
  EyeOff,
  BarChart3,
  Search,
  Filter,
  X
} from 'lucide-react'
import { toast } from '@/lib/toast'

interface SemanticChunk {
  name: string
  type: string
  subtype?: string
  purpose: string
  filePath: string
  size: number
  startLine?: number
  isExported?: boolean
  isAsync?: boolean
  complexity: {
    level: string
    score: number
  }
  includes?: {
    imports: string[]
    types: string[]
  }
  tags: string[]
  code?: string
  bundles: string[]
}

interface SemanticAnalysis {
  summary: {
    totalFiles: number
    totalFunctions: number
    totalChunks: number
    averageChunkSize: number
  }
  chunks: SemanticChunk[]
}

// API functions
const fetchSemanticAnalysis = async (): Promise<SemanticAnalysis> => {
  const response = await fetch('http://localhost:3333/api/semantic-chunks')
  if (!response.ok) throw new Error('Failed to fetch semantic analysis')
  return response.json()
}


export function SemanticChunks() {
  const [showDetails, setShowDetails] = useState<string | null>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [complexityFilter, setComplexityFilter] = useState<string>('all')
  const [purposeFilter, setPurposeFilter] = useState<string>('all')
  const [asyncFilter, setAsyncFilter] = useState<string>('all')
  const [exportedFilter, setExportedFilter] = useState<string>('all')
  const [bundleFilter, setBundleFilter] = useState<string>('all')

  const { data: analysis, isLoading, error, refetch } = useQuery({
    queryKey: ['semantic-analysis'],
    queryFn: fetchSemanticAnalysis,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000 // Refresh every minute
  })


  // Filtered chunks based on search and filters
  const filteredChunks = useMemo(() => {
    if (!analysis?.chunks) return []

    const filtered = analysis.chunks.filter(chunk => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch =
          chunk.name.toLowerCase().includes(searchLower) ||
          chunk.purpose.toLowerCase().includes(searchLower) ||
          chunk.filePath.toLowerCase().includes(searchLower) ||
          chunk.code?.toLowerCase().includes(searchLower)

        if (!matchesSearch) return false
      }

      // Type filter
      if (typeFilter !== 'all' && chunk.subtype !== typeFilter) return false

      // Complexity filter
      if (complexityFilter !== 'all' && chunk.complexity?.level !== complexityFilter) return false

      // Purpose filter
      if (purposeFilter !== 'all' && !chunk.purpose.toLowerCase().includes(purposeFilter.toLowerCase())) return false

      // Async filter
      if (asyncFilter === 'async' && !chunk.isAsync) return false
      if (asyncFilter === 'sync' && chunk.isAsync) return false

      // Exported filter
      if (exportedFilter === 'exported' && !chunk.isExported) return false
      if (exportedFilter === 'internal' && chunk.isExported) return false

      // Bundle filter
      if (bundleFilter !== 'all' && !chunk.bundles?.includes(bundleFilter)) return false

      return true
    })

    return filtered
  }, [analysis?.chunks, searchTerm, typeFilter, complexityFilter, purposeFilter, asyncFilter, exportedFilter, bundleFilter])

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    if (!analysis?.chunks) return { types: [], purposes: [], complexities: [], bundles: [] }

    const types = [...new Set(analysis.chunks.map(c => c.subtype).filter(Boolean))].sort()
    const purposes = [...new Set(analysis.chunks.map(c => c.purpose))].sort()
    const complexities = [...new Set(analysis.chunks.map(c => c.complexity?.level).filter(Boolean))].sort()
    const bundles = [...new Set(analysis.chunks.flatMap(c => c.bundles || []))].sort()

    return { types, purposes, complexities, bundles }
  }, [analysis?.chunks])

  const clearFilters = () => {
    setSearchTerm('')
    setTypeFilter('all')
    setComplexityFilter('all')
    setPurposeFilter('all')
    setAsyncFilter('all')
    setExportedFilter('all')
    setBundleFilter('all')
  }

  const hasActiveFilters = searchTerm || typeFilter !== 'all' || complexityFilter !== 'all' ||
    purposeFilter !== 'all' || asyncFilter !== 'all' || exportedFilter !== 'all' || bundleFilter !== 'all'


  const getChunkIcon = (chunk: SemanticChunk) => {
    if (chunk.subtype === 'react_component' || chunk.tags?.includes('react_component')) return <Code className="w-4 h-4" />
    if (chunk.purpose?.includes('React hook')) return <Zap className="w-4 h-4" />
    if (chunk.subtype === 'arrow_function') return <FileText className="w-4 h-4" />
    if (chunk.subtype === 'method') return <Package className="w-4 h-4" />
    return <FileText className="w-4 h-4" />
  }

  const getComplexityColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Analyzing code semantics...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Failed to load semantic analysis. Make sure the server supports semantic chunking.
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) return null


  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={clearFilters}
              >
                <X className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search functions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-8 text-xs"
                />
              </div>
            </div>

            {/* Function Type */}
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {filterOptions.types.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Complexity */}
            <div>
              <Select value={complexityFilter} onValueChange={setComplexityFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Complexity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Complexity</SelectItem>
                  {filterOptions.complexities.map(complexity => (
                    <SelectItem key={complexity} value={complexity}>{complexity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purpose */}
            <div>
              <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Purposes</SelectItem>
                  {filterOptions.purposes.map(purpose => (
                    <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Async/Sync */}
            <div>
              <Select value={asyncFilter} onValueChange={setAsyncFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Async" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  <SelectItem value="async">Async Only</SelectItem>
                  <SelectItem value="sync">Sync Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bundle */}
            <div>
              <Select value={bundleFilter} onValueChange={setBundleFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Bundle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bundles</SelectItem>
                  {filterOptions.bundles.map(bundle => (
                    <SelectItem key={bundle} value={bundle}>{bundle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {searchTerm && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  Search: "{searchTerm}"
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSearchTerm('')
                    }}
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {typeFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  Type: {typeFilter}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setTypeFilter('all')
                    }}
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {complexityFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  Complexity: {complexityFilter}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setComplexityFilter('all')
                    }}
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {purposeFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  Purpose: {purposeFilter}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setPurposeFilter('all')
                    }}
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {asyncFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  {asyncFilter === 'async' ? 'Async Only' : 'Sync Only'}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setAsyncFilter('all')
                    }}
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {bundleFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  Bundle: {bundleFilter}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setBundleFilter('all')
                    }}
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Project Analysis
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-medium">{analysis.summary?.totalFiles || 0}</div>
              <div className="text-xs text-muted-foreground font-normal">Files Analyzed</div>
            </div>
            <div>
              <div className="text-lg font-medium">{analysis.summary?.totalFunctions || 0}</div>
              <div className="text-xs text-muted-foreground font-normal">Functions Extracted</div>
            </div>
            <div>
              <div className="text-lg font-medium">
                {filteredChunks.length}
                {hasActiveFilters && (
                  <span className="text-sm text-muted-foreground"> / {analysis.summary?.totalChunks || 0}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground font-normal">
                {hasActiveFilters ? 'Filtered' : 'Total'} Chunks
              </div>
            </div>
            <div>
              <div className="text-lg font-medium">{Math.round(analysis.summary?.averageChunkSize || 0)}</div>
              <div className="text-xs text-muted-foreground font-normal">Avg Chunk Size</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Semantic Chunks Grid */}
      <div className="grid gap-4">
        {filteredChunks.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No chunks match your filters</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting your search criteria or clearing the filters.
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredChunks.map((chunk, index) => (
            <Card key={`${chunk.filePath}-${chunk.name}-${index}`} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getChunkIcon(chunk)}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm font-medium tracking-wide">
                        {chunk.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs h-4">
                          {chunk.subtype || chunk.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs h-4">
                          {chunk.size} chars
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs h-4 ${getComplexityColor(chunk.complexity?.level || 'unknown')}`}
                        >
                          {chunk.complexity?.level || 'unknown'} complexity
                        </Badge>
                        {chunk.isAsync && (
                          <Badge variant="outline" className="text-xs h-4 bg-blue-50">
                            async
                          </Badge>
                        )}
                        {chunk.isExported && (
                          <Badge variant="outline" className="text-xs h-4 bg-green-50">
                            exported
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowDetails(showDetails === chunk.name ? null : chunk.name)}
                    >
                      {showDetails === chunk.name ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Purpose and Tags */}
                  <div>
                    <p className="text-xs text-muted-foreground font-normal mb-2">
                      🎯 {chunk.purpose}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(chunk.tags || []).slice(0, 6).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs h-4">
                          {tag}
                        </Badge>
                      ))}
                      {(chunk.tags || []).length > 6 && (
                        <Badge variant="secondary" className="text-xs h-4">
                          +{(chunk.tags || []).length - 6} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* File Path and Location */}
                  <div>
                    <div className="text-xs font-medium mb-1">Location:</div>
                    <div className="text-xs text-muted-foreground font-normal font-mono">
                      {chunk.filePath}{chunk.startLine ? `:${chunk.startLine}` : ''}
                    </div>
                  </div>

                  {/* Bundle Membership */}
                  {(chunk.bundles?.length || 0) > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-blue-50 rounded text-xs">
                      <Package className="w-3 h-3 mt-0.5 text-blue-600" />
                      <div>
                        <div className="font-medium text-blue-800">Bundles:</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {chunk.bundles?.map(bundle => (
                            <Badge key={bundle} variant="outline" className="text-xs h-4 bg-blue-100 text-blue-700 border-blue-200">
                              {bundle}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Function Includes (imports/types) */}
                  {(chunk.includes?.imports.length || 0) > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs">
                      <Package className="w-3 h-3 mt-0.5 text-blue-500" />
                      <div>
                        <div className="font-medium">Imports:</div>
                        <div className="font-normal">{chunk.includes?.imports.slice(0, 3).join(', ')}</div>
                        {(chunk.includes?.imports.length || 0) > 3 && (
                          <div className="text-muted-foreground">+{(chunk.includes?.imports.length || 0) - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {showDetails === chunk.name && (
                    <div className="border-t pt-3 space-y-3">
                      {/* Function Code Preview */}
                      {chunk.code && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-medium">Function Code:</div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(chunk.code || '')
                                toast.success('Code copied to clipboard!')
                              }}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <div className="bg-muted/30 rounded p-3 text-xs font-mono overflow-x-auto">
                            <pre className="whitespace-pre-wrap">{chunk.code}</pre>
                          </div>
                        </div>
                      )}

                      {/* Dependencies */}
                      {(chunk.includes?.imports.length || 0) > 0 && (
                        <div>
                          <div className="text-xs font-medium mb-2">All Imports:</div>
                          <div className="space-y-1">
                            {chunk.includes?.imports.map((imp, idx) => (
                              <div key={idx} className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                                {imp}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Types */}
                      {(chunk.includes?.types.length || 0) > 0 && (
                        <div>
                          <div className="text-xs font-medium mb-2">Related Types:</div>
                          <div className="space-y-1">
                            {chunk.includes?.types.map((type, idx) => (
                              <div key={idx} className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                                {type}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )))}
      </div>

    </div>
  )
}
