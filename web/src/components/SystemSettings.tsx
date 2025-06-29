import { useState, useEffect } from 'react'
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Alert, AlertDescription } from './ui/alert'
import { FileText, Save, RotateCcw, Info, Copy, ExternalLink } from 'lucide-react'
import { toast } from '@/lib/toast'
import { EditorPreference } from './EditorPreference'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'

// API functions
const fetchFileContent = async (endpoint: string): Promise<string> => {
  const response = await fetch(`http://localhost:3333/api/${endpoint}`)
  if (!response.ok) throw new Error(`Failed to fetch ${endpoint} file`)
  return response.text()
}

const saveFileContent = async ({ endpoint, content }: { endpoint: string, content: string }) => {
  const response = await fetch(`http://localhost:3333/api/${endpoint}` , {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })
  if (!response.ok) throw new Error(`Failed to save ${endpoint} file`)
  return response.json()
}

function FileEditorView({ fileType, endpoint, filePath }: { fileType: string, endpoint: string, filePath: string }) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const { data: originalContent, isLoading } = useQuery({
    queryKey: [fileType],
    queryFn: () => fetchFileContent(endpoint)
  })

  useEffect(() => {
    if (originalContent !== undefined) {
      setContent(originalContent)
      setHasChanges(false)
    }
  }, [originalContent])

  const saveMutation = useMutation({
    mutationFn: saveFileContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [fileType] })
      setHasChanges(false)
      toast.success(`${fileType} file saved`)
    },
    onError: (error: Error) => toast.error(`Failed to save: ${error.message}`)
  })

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setHasChanges(newContent !== originalContent)
  }

  const handleSave = () => {
    saveMutation.mutate({ endpoint, content })
  }

  const handleReset = () => {
    setContent(originalContent || '')
    setHasChanges(false)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied to clipboard')
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      toast.error('Copy failed')
    }
  }

  const openInEditor = async () => {
    try {
      const response = await fetch('http://localhost:3333/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open file');
      }
      toast.success(`Opening ${fileType} in editor...`);
    } catch (err) {
      console.error('Failed to open in editor:', err);
      toast.error(`Could not open file: ${err.message}`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-thin">
          <FileText className="w-4 h-4" />
          {fileType}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 px-2"><Copy className="w-3 h-3" /></Button>
          <Button variant="ghost" size="sm" onClick={openInEditor} className="h-7 px-2"><ExternalLink className="w-3 h-3" /></Button>
          {hasChanges && (
            <Button variant="outline" size="sm" onClick={handleReset} className="h-7 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending} size="sm" className="h-7 text-xs">
            <Save className="w-3 h-3 mr-1" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading {fileType} file...
          </div>
        ) : (
          <>
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={`# Add ignore patterns for ${fileType}, one per line`}
              className="min-h-[300px] font-mono text-xs"
            />
            <div className="text-xs text-muted-foreground">
              {content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#')).length} active patterns
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function IgnorePatternsEditor() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="cntxignore">
        <TabsList>
          <TabsTrigger value="cntxignore">.cntxignore</TabsTrigger>
          <TabsTrigger value="gitignore">.gitignore</TabsTrigger>
        </TabsList>
        <TabsContent value="cntxignore">
          <FileEditorView fileType=".cntxignore" endpoint="cntxignore" filePath=".cntxignore" />
        </TabsContent>
        <TabsContent value="gitignore">
          <FileEditorView fileType=".gitignore" endpoint="gitignore" filePath=".gitignore" />
        </TabsContent>
      </Tabs>
      <Card>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-2">
            <div><strong>Common patterns:</strong></div>
            <div>• <code>node_modules/**</code> - Ignore all node_modules</div>
            <div>• <code>*.log</code> - Ignore log files</div>
            <div>• <code>src/debug/**</code> - Ignore debug directory</div>
            <div>• <code>**/*.test.*</code> - Ignore test files</div>
            <div>• <code>.git/**</code> - Ignore git directory</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function SystemSettings() {
  return (
    <Tabs defaultValue="ignore">
      <TabsList>
        <TabsTrigger value="ignore">File Ignore Patterns</TabsTrigger>
        <TabsTrigger value="editor">Editor Preference</TabsTrigger>
      </TabsList>
      <TabsContent value="ignore">
        <IgnorePatternsEditor />
      </TabsContent>
      <TabsContent value="editor">
        <EditorPreference />
      </TabsContent>
    </Tabs>
  )
}