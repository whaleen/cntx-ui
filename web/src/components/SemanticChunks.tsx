import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Search, Fingerprint, Eye, ExternalLink, Zap, Braces, Code2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
      const res = await fetch('/api/semantic-chunks')
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
      const res = await fetch('/api/semantic-search', {
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
      await fetch('/api/open-file', {
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
            <h1 className="text-lg  tracking-tight flex items-center gap-2">
              <Code2 className="w-4 h-4 text-primary" />
              Repository Intelligence
            </h1>
            <p className="text-xs text-muted-foreground ">Surgical code chunks indexed for agents</p>
          </div>
          <Badge variant="outline" className="border-border  text-[10px] uppercase tracking-widest">
            {initialData?.length || 0} Chunks Indexed
          </Badge>
        </div>

        <form onSubmit={handleSemanticSearch} className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search code by meaning (e.g. 'handle file exports' or 'react components')"
            className="pl-10 bg-card border-border text-sm h-10"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Zap className="w-3 h-3 animate-pulse text-primary" />
            </div>
          )}
        </form>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <Braces className="w-10 h-10 animate-pulse mb-4 text-primary" />
          <span className="text-xs  tracking-widest uppercase">Analyzing Codebase Intelligence...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chunksToDisplay.map((chunk) => (
            <Card key={chunk.id} className="border-border bg-card hover:border-border-accent transition-all group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <Fingerprint className="w-4 h-4 text-muted-foreground mt-1" />
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold truncate text-foreground">
                        {chunk.name === 'list' ? `list — ${chunk.filePath.split('/').pop()}` : chunk.name}
                      </CardTitle>
                      <div className="text-[10px] mono text-muted-foreground truncate mt-0.5">{chunk.filePath}:{chunk.startLine || 1}</div>
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
                <p className="text-[11px] text-foreground line-clamp-2 italic leading-relaxed">
                  "{chunk.purpose}"
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[9px] uppercase border-border text-muted-foreground px-1.5 h-4">
                    {chunk.subtype || chunk.type}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="text-[9px] uppercase border-border text-muted-foreground px-1.5 h-4 flex items-center gap-1"
                    title="Code complexity score (1-10+). Higher means more logic paths or nesting."
                  >
                    <div 
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        (chunk.complexity?.score || 0) <= 2 ? "bg-green-500" :
                        (chunk.complexity?.score || 0) <= 4 ? "bg-yellow-500" :
                        "bg-red-500"
                      )} 
                      aria-label={`Complexity level: ${chunk.complexity?.level || 'unknown'}`}
                    />
                    Complexity: {chunk.complexity?.score || 0}
                  </Badge>
                  {chunk.similarity && (
                    <Badge variant="outline" className="text-[9px]  uppercase border-border-accent text-primary px-1.5 h-4">
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
