import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Search, Fingerprint, Eye, ExternalLink, Zap, Braces, Code2 } from 'lucide-react'
import { toast } from '@/lib/toast'

interface SemanticChunk {
  id: string
  name: string
  type: string
  subtype?: string
  purpose: string
  filePath: string
  code: string
  startLine?: number
  complexity: {
    level: string
    score: number
  }
  similarity?: number
}

export function SemanticChunks() {
  const [searchTerm, setSearchTerm] = useState('')
  const [semanticResults, setSemanticResults] = useState<SemanticChunk[] | null>(null)
  const [searching, setSemanticSearching] = useState(false)

  // Initial fetch of all chunks (limited)
  const { data: initialData, isLoading } = useQuery({
    queryKey: ['initial-chunks'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3333/api/semantic-chunks')
      const data = await res.json()
      return data.chunks as SemanticChunk[]
    }
  })

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) {
      setSemanticResults(null)
      return
    }

    setSemanticSearching(true)
    try {
      const res = await fetch('http://localhost:3333/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm, limit: 15 })
      })
      if (res.ok) {
        const data = await res.json()
        setSemanticResults(data.results)
      }
    } catch (err) {
      toast.error('Semantic search failed')
    } finally {
      setSemanticSearching(false)
    }
  }

  const chunksToDisplay = semanticResults || initialData || []

  const openInEditor = async (filePath: string, line?: number) => {
    try {
      await fetch('http://localhost:3333/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, line })
      })
      toast.success(`Opening ${filePath}`)
    } catch (err) {
      toast.error('Failed to open editor')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-thin tracking-tight flex items-center gap-2">
              <Code2 className="w-4 h-4 text-vesper-accent" />
              Repository Intelligence
            </h1>
            <p className="text-xs text-muted-foreground font-thin">Surgical code chunks indexed for agents</p>
          </div>
          <Badge variant="outline" className="border-vesper font-thin text-[10px] uppercase tracking-widest">
            {initialData?.length || 0} Chunks Indexed
          </Badge>
        </div>

        <form onSubmit={handleSemanticSearch} className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search code by meaning (e.g. 'handle file exports' or 'react components')"
            className="pl-10 bg-vesper-card border-vesper text-sm h-10"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Zap className="w-3 h-3 animate-pulse text-vesper-accent" />
            </div>
          )}
        </form>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <Braces className="w-10 h-10 animate-pulse mb-4 text-vesper-accent" />
          <span className="text-xs font-thin tracking-widest uppercase">Analyzing Codebase Intelligence...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chunksToDisplay.map((chunk) => (
            <Card key={chunk.id} className="border-vesper bg-vesper-card hover:border-vesper-accent transition-all group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <Fingerprint className="w-4 h-4 text-muted-foreground mt-1" />
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold truncate color-vesper-fg">{chunk.name}</CardTitle>
                      <div className="text-[10px] mono color-vesper-muted truncate mt-0.5">{chunk.filePath}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openInEditor(chunk.filePath, chunk.startLine)}>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[11px] color-vesper-fg line-clamp-2 italic leading-relaxed">
                  "{chunk.purpose}"
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[9px] font-thin uppercase border-vesper color-vesper-muted px-1.5 h-4">
                    {chunk.subtype || chunk.type}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] font-thin uppercase border-vesper color-vesper-muted px-1.5 h-4">
                    Complexity: {chunk.complexity?.score || 0}
                  </Badge>
                  {chunk.similarity && (
                    <Badge variant="outline" className="text-[9px] font-thin uppercase border-vesper-accent color-vesper-accent px-1.5 h-4">
                      Match: {Math.round(chunk.similarity * 100)}%
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
