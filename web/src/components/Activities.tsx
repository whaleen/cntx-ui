import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from '@/lib/toast'
import {
  CheckCircle, Clock, AlertTriangle, Activity, FileText, RefreshCw,
  ChevronDown, ChevronRight, Eye, Code, Copy, ExternalLink, BrainCircuit, User
} from 'lucide-react'

interface ActivityDefinition {
  id: string
  name: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  priority: 'low' | 'medium' | 'high'
  progress?: number
  updatedAt: string
  files: { readme: string; progress: string; tasks: string; notes: string }
}

const MarkdownViewer = ({ content, fileName, activityId }: { content: string, fileName: string, activityId: string }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered')

  const openInEditor = async () => {
    try {
      await fetch('http://localhost:3333/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: `.cntx/activities/activities/${activityId}/${fileName}` })
      });
      toast.success('Opening in editor');
    } catch (err) {
      toast.error('Failed to open file');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-vesper pb-2">
        <div className="flex gap-1">
          <Button variant={viewMode === 'rendered' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('rendered')} className="h-6 text-[10px] uppercase">Rendered</Button>
          <Button variant={viewMode === 'raw' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('raw')} className="h-6 text-[10px] uppercase">Raw</Button>
        </div>
        <Button variant="ghost" size="sm" onClick={openInEditor} className="h-6 color-vesper-muted"><ExternalLink className="w-3 h-3" /></Button>
      </div>

      <div className="max-h-96 overflow-auto pr-2">
        {viewMode === 'rendered' ? (
          <div className="markdown-body text-sm leading-relaxed color-vesper-fg">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              h1: ({children}) => <h1 className="text-lg font-bold color-vesper-accent mt-4 mb-2">{children}</h1>,
              h2: ({children}) => <h2 className="text-base font-bold color-vesper-accent mt-4 mb-2">{children}</h2>,
              pre: ({children}) => <pre className="bg-black/30 border border-vesper p-3 rounded font-mono text-xs overflow-x-auto mb-3">{children}</pre>,
              code: ({children}) => <code className="bg-vesper-card px-1 rounded text-xs font-mono">{children}</code>,
              a: ({children, href}) => <a href={href} className="color-vesper-accent underline">{children}</a>,
              li: ({children}) => <li className="mb-1">{children}</li>,
              input: ({type, checked}) => type === 'checkbox' ? <input type="checkbox" checked={checked} disabled className="mr-2 accent-vesper-accent" /> : null
            }}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="text-xs font-mono bg-black/20 p-3 rounded border border-vesper color-vesper-muted whitespace-pre-wrap">{content}</pre>
        )}
      </div>
    </div>
  )
}

const ReasoningView = ({ activityId }: { activityId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['reasoning', activityId],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3333/api/activities/${activityId}/reasoning`)
      return res.json()
    }
  })

  if (isLoading) return <div className="py-10 text-center animate-pulse color-vesper-muted text-xs uppercase tracking-widest">Recalling Memory...</div>

  const history = data?.history || []

  return (
    <div className="space-y-4 mt-4">
      {history.length === 0 ? (
        <div className="py-10 text-center color-vesper-muted text-xs italic border border-dashed border-vesper rounded">No agent interactions logged for this activity.</div>
      ) : (
        history.map((msg: any, i: number) => (
          <div key={i} className={`flex gap-3 p-3 rounded border ${msg.role === 'agent' ? 'bg-vesper-card border-vesper' : 'bg-black/10 border-transparent'}`}>
            {msg.role === 'agent' ? <BrainCircuit className="w-4 h-4 text-vesper-accent shrink-0" /> : <User className="w-4 h-4 text-vesper-muted shrink-0" />}
            <div className="space-y-1 overflow-hidden">
              <div className="text-[10px] uppercase tracking-widest color-vesper-muted font-bold">{msg.role}</div>
              <div className="text-xs leading-relaxed color-vesper-fg whitespace-pre-wrap">{msg.content}</div>
              <div className="text-[9px] color-vesper-muted opacity-50">{new Date(msg.timestamp).toLocaleString()}</div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export function Activities() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3333/api/activities')
      return res.json() as Promise<ActivityDefinition[]>
    },
    refetchInterval: 10000
  })

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-thin tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-vesper-accent" />
            Active Missions
          </h1>
          <p className="text-xs text-muted-foreground font-thin">Strategic agent task tracking and reasoning</p>
        </div>
        <Button onClick={() => refetch()} variant="ghost" size="sm" className="h-8 color-vesper-muted hover:color-vesper-accent">
          <RefreshCw className="w-3 h-3 mr-2" />
          Sync
        </Button>
      </header>

      <div className="space-y-3">
        {activities.map((activity) => (
          <Card key={activity.id} className={`border-vesper bg-vesper-card transition-all ${expanded === activity.id ? 'ring-1 ring-vesper-accent' : ''}`}>
            <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => setExpanded(expanded === activity.id ? null : activity.id)}>
              <div className="flex items-center gap-3">
                {expanded === activity.id ? <ChevronDown className="w-4 h-4 text-vesper-accent" /> : <ChevronRight className="w-4 h-4 color-vesper-muted" />}
                <div className="space-y-0.5">
                  <div className="text-sm font-bold color-vesper-fg">{activity.name}</div>
                  <div className="text-[10px] color-vesper-muted uppercase tracking-wider">{activity.status}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {activity.progress !== undefined && (
                  <div className="flex items-center gap-2 w-32">
                    <Progress value={activity.progress} className="h-1.5 bg-black/40" />
                    <span className="text-[10px] font-mono color-vesper-fg">{activity.progress}%</span>
                  </div>
                )}
                <Badge variant="outline" className="text-[9px] border-vesper font-thin uppercase px-1.5 h-4">
                  {activity.priority}
                </Badge>
              </div>
            </div>

            {expanded === activity.id && (
              <CardContent className="pt-0 border-t border-vesper/30 mt-2 p-4">
                <Tabs defaultValue="reasoning" className="w-full">
                  <TabsList className="grid grid-cols-5 h-8 bg-black/20 p-1 border-vesper">
                    <TabsTrigger value="reasoning" className="text-[9px] uppercase tracking-tighter">Reasoning</TabsTrigger>
                    <TabsTrigger value="readme" className="text-[9px] uppercase tracking-tighter">Instructions</TabsTrigger>
                    <TabsTrigger value="progress" className="text-[9px] uppercase tracking-tighter">Progress</TabsTrigger>
                    <TabsTrigger value="tasks" className="text-[9px] uppercase tracking-tighter">Tasks</TabsTrigger>
                    <TabsTrigger value="notes" className="text-[9px] uppercase tracking-tighter">Notes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="reasoning"><ReasoningView activityId={activity.id} /></TabsContent>
                  <TabsContent value="readme" className="mt-4"><MarkdownViewer content={activity.files.readme} fileName="README.md" activityId={activity.id} /></TabsContent>
                  <TabsContent value="progress" className="mt-4"><MarkdownViewer content={activity.files.progress} fileName="progress.md" activityId={activity.id} /></TabsContent>
                  <TabsContent value="tasks" className="mt-4"><MarkdownViewer content={activity.files.tasks} fileName="tasks.md" activityId={activity.id} /></TabsContent>
                  <TabsContent value="notes" className="mt-4"><MarkdownViewer content={activity.files.notes} fileName="notes.md" activityId={activity.id} /></TabsContent>
                </Tabs>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
