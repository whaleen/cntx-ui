/* eslint-disable @typescript-eslint/no-explicit-any */
// web/src/components/Activities.tsx
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
  CheckCircle,
  Clock,
  AlertTriangle,
  Activity,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  Code,
  Copy,
  ExternalLink
} from 'lucide-react'
import { useState } from 'react'

interface ActivityDefinition {
  id: string
  name: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  priority: 'low' | 'medium' | 'high'
  progress?: number
  updatedAt: string
  category: string
  files: {
    readme: string
    progress: string
    tasks: string
    notes: string
  }
  tags?: string[]
}

const fetchActivities = async (): Promise<ActivityDefinition[]> => {
  const response = await fetch('http://localhost:3333/api/activities')
  if (!response.ok) throw new Error('Failed to fetch activities')
  return response.json()
}

const MarkdownViewer = ({ content, fileName, activityId }: { content: string, fileName: string, activityId: string }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered')

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied to clipboard', `${fileName} content copied successfully`)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      toast.error('Copy failed', 'Unable to copy content to clipboard')
    }
  }

  const openInEditor = async () => {
    try {
      const response = await fetch('http://localhost:3333/api/open-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: `.cntx/activities/activities/${activityId}/${fileName}`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open file via API');
      }

      toast.success('Opening file in editor...');

    } catch (err) {
      console.error('Failed to open in editor:', err);
      toast.error('Could not open file', err.message);
    }
  }

  return (
    <div className="space-y-2">
      {/* Button bar */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center space-x-1">
          <Button
            variant={viewMode === 'rendered' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('rendered')}
            className="h-6 px-2 text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            Rendered
          </Button>
          <Button
            variant={viewMode === 'raw' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('raw')}
            className="h-6 px-2 text-xs"
          >
            <Code className="w-3 h-3 mr-1" />
            Raw
          </Button>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="h-6 px-2 text-xs"
            title="Copy to clipboard"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openInEditor}
            className="h-6 px-2 text-xs"
            title="Open in editor"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="overflow-auto max-h-80">
        {viewMode === 'rendered' ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom styling for different elements
                h1: ({ children }) => <h1 className="text-lg font-semibold mb-3 mt-4 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-3">{children}</h3>,
                p: ({ children }) => <p className="text-sm mb-2 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="text-sm space-y-1 mb-3 ml-4">{children}</ul>,
                ol: ({ children }) => <ol className="text-sm space-y-1 mb-3 ml-4">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                pre: ({ children }) => <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto mb-3">{children}</pre>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-muted-foreground/20 pl-3 italic text-muted-foreground text-sm mb-3">{children}</blockquote>,
                table: ({ children }) => <table className="text-xs border-collapse border border-border mb-3 w-full">{children}</table>,
                th: ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-semibold text-left">{children}</th>,
                td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
                // Enhanced checkbox styling for task lists
                input: ({ type, checked, ...props }) => (
                  type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled
                      className="mr-2 scale-75"
                      {...props}
                    />
                  ) : <input {...props} />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/50 p-3 rounded border">
            {content}
          </pre>
        )}
      </div>
    </div>
  )
}

export function Activities() {
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)

  const { data: activities = [], isLoading, error, refetch } = useQuery({
    queryKey: ['activities'],
    queryFn: fetchActivities,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3" />
      case 'in_progress':
        return <Clock className="h-3 w-3" />
      case 'failed':
        return <AlertTriangle className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  const getStatusBadge = (status: string) => (
    <Badge variant="outline" className="text-xs py-0">
      {status.replace('_', ' ')}
    </Badge>
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Activities</h2>
          <RefreshCw className="h-4 w-4 animate-spin" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3">
                <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-2 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Activities</h2>
        <Card>
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <AlertTriangle className="h-6 w-6 mx-auto" />
              <p className="text-sm font-medium">Failed to load activities</p>
              <p className="text-xs text-muted-foreground">
                Make sure the cntx-ui server is running and activities are configured.
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activities ({activities.length})
          </h2>
          <p className="text-xs text-muted-foreground">Agent task definitions and progress</p>
        </div>
        <Button onClick={() => refetch()} variant="ghost" size="sm">
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
              <h3 className="text-sm font-medium">No activities found</h3>
              <p className="text-xs text-muted-foreground">
                Activities will appear here once they are defined in your .cntx/activities directory.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <Card key={activity.id} className="overflow-hidden">
              <CardHeader
                className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {expandedActivity === activity.id ?
                      <ChevronDown className="h-3 w-3" /> :
                      <ChevronRight className="h-3 w-3" />
                    }
                    {getStatusIcon(activity.status)}
                    <div>
                      <CardTitle className="text-sm">{activity.name}</CardTitle>
                      {/* <p className="text-xs text-muted-foreground">{activity.description}</p> */}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(activity.status)}
                    {activity.progress !== undefined && activity.progress > 0 && (
                      <div className="flex items-center space-x-2">
                        <Progress value={activity.progress} className="w-16 h-2" />
                        <Badge variant="secondary" className="text-xs py-0">
                          {activity.progress}%
                        </Badge>
                      </div>
                    )}
                    {activity.tags && activity.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>

              {expandedActivity === activity.id && (
                <CardContent className="pt-0 pb-2">
                  <Tabs defaultValue="readme" className="w-full">
                    <TabsList className="grid w-full bg-card grid-cols-4 h-8 space-x-2">
                      <TabsTrigger value="readme" className="text-xs border-accent-muted">README</TabsTrigger>
                      <TabsTrigger value="progress" className="text-xs border-accent-muted">Progress</TabsTrigger>
                      <TabsTrigger value="tasks" className="text-xs border-accent-muted">Tasks</TabsTrigger>
                      <TabsTrigger value="notes" className="text-xs border-accent-muted">Notes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="readme" className="mt-2 mb-0">
                      <MarkdownViewer
                        content={activity.files.readme}
                        fileName="README.md"
                        activityId={activity.id}
                      />
                    </TabsContent>

                    <TabsContent value="progress" className="mt-2 mb-0">
                      {activity.progress > 0 && (
                        <div className="mb-4 p-3 bg-muted/50 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Overall Progress</span>
                            <span className="text-sm text-muted-foreground">{activity.progress}%</span>
                          </div>
                          <Progress value={activity.progress} className="w-full h-3" />
                        </div>
                      )}
                      <MarkdownViewer
                        content={activity.files.progress}
                        fileName="progress.md"
                        activityId={activity.id}
                      />
                    </TabsContent>

                    <TabsContent value="tasks" className="mt-2 mb-0">
                      <MarkdownViewer
                        content={activity.files.tasks}
                        fileName="tasks.md"
                        activityId={activity.id}
                      />
                    </TabsContent>

                    <TabsContent value="notes" className="mt-2 mb-0">
                      <MarkdownViewer
                        content={activity.files.notes}
                        fileName="notes.md"
                        activityId={activity.id}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
