import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Save, RefreshCw, Sparkles, FileText, Code2 } from 'lucide-react'
import { toast } from '@/lib/toast'

const fetchCursorRules = async (): Promise<string> => {
  const response = await fetch('http://localhost:3333/api/cursor-rules')
  if (!response.ok) throw new Error('Failed to fetch cursor rules')
  return response.text()
}

const saveCursorRules = async (content: string): Promise<void> => {
  const response = await fetch('http://localhost:3333/api/cursor-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })
  if (!response.ok) throw new Error('Failed to save cursor rules')
}

const fetchClaudeMd = async (): Promise<string> => {
  const response = await fetch('http://localhost:3333/api/claude-md')
  if (!response.ok) throw new Error('Failed to fetch CLAUDE.md')
  return response.text()
}

const saveClaudeMd = async (content: string): Promise<void> => {
  const response = await fetch('http://localhost:3333/api/claude-md', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })
  if (!response.ok) throw new Error('Failed to save CLAUDE.md')
}

export function AIRulesManager() {
  const queryClient = useQueryClient()
  const [editingCursorRules, setEditingCursorRules] = useState<string>('')
  const [editingClaudeMd, setEditingClaudeMd] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'cursor' | 'claude'>('claude')

  const { data: currentCursorRules, isLoading: cursorRulesLoading } = useQuery({
    queryKey: ['cursor-rules'],
    queryFn: fetchCursorRules
  })

  const cursorRulesMutation = useMutation({
    mutationFn: saveCursorRules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cursor-rules'] })
      toast.success('Cursor Rules Saved')
    },
    onError: (error) => toast.error(`Failed to save: ${error.message}`)
  })

  const { data: currentClaudeMd, isLoading: claudeMdLoading } = useQuery({
    queryKey: ['claude-md'],
    queryFn: fetchClaudeMd
  })

  const claudeMdMutation = useMutation({
    mutationFn: saveClaudeMd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-md'] })
      toast.success('Claude Instructions Saved')
    },
    onError: (error) => toast.error(`Failed to save: ${error.message}`)
  })

  useEffect(() => {
    if (currentCursorRules !== undefined && !editingCursorRules) setEditingCursorRules(currentCursorRules)
  }, [currentCursorRules])

  useEffect(() => {
    if (currentClaudeMd !== undefined && !editingClaudeMd) setEditingClaudeMd(currentClaudeMd)
  }, [currentClaudeMd])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-thin tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-vesper-accent" />
            Agent Governance
          </h1>
          <p className="text-xs text-muted-foreground font-thin">Configure rules and context for AI collaborators</p>
        </div>
      </header>

      <Card className="border-vesper bg-vesper-card">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cursor' | 'claude')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-black/20 p-0 border-b border-vesper h-10 rounded-none">
              <TabsTrigger value="claude" className="rounded-none data-[state=active]:bg-vesper-card data-[state=active]:text-vesper-accent text-xs uppercase tracking-widest font-thin h-full">
                <FileText className="w-3 h-3 mr-2" />
                CLAUDE.md
              </TabsTrigger>
              <TabsTrigger value="cursor" className="rounded-none data-[state=active]:bg-vesper-card data-[state=active]:text-vesper-accent text-xs uppercase tracking-widest font-thin h-full">
                <Code2 className="w-3 h-3 mr-2" />
                .cursorrules
              </TabsTrigger>
            </TabsList>

            <TabsContent value="claude" className="p-4 m-0 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[11px] color-vesper-muted italic">
                  Defines project architecture, conventions, and goals for Claude Code.
                </p>
                <Button 
                  onClick={() => claudeMdMutation.mutate(editingClaudeMd)} 
                  disabled={claudeMdMutation.isPending} 
                  size="sm" 
                  className="h-7 text-[10px] uppercase tracking-widest bg-vesper-accent text-black hover:opacity-90"
                >
                  {claudeMdMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                  Save Instructions
                </Button>
              </div>
              
              {claudeMdLoading ? (
                <div className="py-20 text-center animate-pulse color-vesper-muted text-xs uppercase tracking-widest">Loading Instructions...</div>
              ) : (
                <Textarea
                  value={editingClaudeMd}
                  onChange={(e) => setEditingClaudeMd(e.target.value)}
                  className="min-h-[400px] font-mono text-[11px] leading-relaxed bg-black/30 border-vesper color-vesper-fg"
                />
              )}
            </TabsContent>

            <TabsContent value="cursor" className="p-4 m-0 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[11px] color-vesper-muted italic">
                  Specific environment configuration and prompt engineering for Cursor.
                </p>
                <Button 
                  onClick={() => cursorRulesMutation.mutate(editingCursorRules)} 
                  disabled={cursorRulesMutation.isPending} 
                  size="sm" 
                  className="h-7 text-[10px] uppercase tracking-widest bg-vesper-accent text-black hover:opacity-90"
                >
                  {cursorRulesMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                  Save Rules
                </Button>
              </div>
              
              {cursorRulesLoading ? (
                <div className="py-20 text-center animate-pulse color-vesper-muted text-xs uppercase tracking-widest">Loading Rules...</div>
              ) : (
                <Textarea
                  value={editingCursorRules}
                  onChange={(e) => setEditingCursorRules(e.target.value)}
                  className="min-h-[400px] font-mono text-[11px] leading-relaxed bg-black/30 border-vesper color-vesper-fg"
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
