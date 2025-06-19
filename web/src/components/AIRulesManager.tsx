import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Alert, AlertDescription } from './ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Save, RefreshCw, Copy, Download, Sparkles, FileText, Info } from 'lucide-react'
import { toast } from 'sonner'

// Fetch functions for .cursorrules
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

// Fetch functions for CLAUDE.md
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
  const [activeTab, setActiveTab] = useState<'cursor' | 'claude'>('cursor')

  // Cursor Rules queries
  const { data: currentCursorRules, isLoading: cursorRulesLoading } = useQuery({
    queryKey: ['cursor-rules'],
    queryFn: fetchCursorRules
  })

  const cursorRulesMutation = useMutation({
    mutationFn: saveCursorRules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cursor-rules'] })
      toast.success('.cursorrules saved successfully!')
    },
    onError: (error) => {
      toast.error(`Failed to save .cursorrules: ${error.message}`)
    }
  })

  // CLAUDE.md queries  
  const { data: currentClaudeMd, isLoading: claudeMdLoading } = useQuery({
    queryKey: ['claude-md'],
    queryFn: fetchClaudeMd
  })

  const claudeMdMutation = useMutation({
    mutationFn: saveClaudeMd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-md'] })
      toast.success('CLAUDE.md saved successfully!')
    },
    onError: (error) => {
      toast.error(`Failed to save CLAUDE.md: ${error.message}`)
    }
  })

  // Initialize editing states when data loads
  useEffect(() => {
    if (currentCursorRules && !editingCursorRules) {
      setEditingCursorRules(currentCursorRules)
    }
  }, [currentCursorRules])

  useEffect(() => {
    if (currentClaudeMd && !editingClaudeMd) {
      setEditingClaudeMd(currentClaudeMd)
    }
  }, [currentClaudeMd])

  const handleSaveCursorRules = () => {
    cursorRulesMutation.mutate(editingCursorRules)
  }

  const handleSaveClaudeMd = () => {
    claudeMdMutation.mutate(editingClaudeMd)
  }

  const handleCopyToClipboard = (content: string, type: string) => {
    navigator.clipboard.writeText(content)
    toast.success(`${type} copied to clipboard!`)
  }

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`${filename} downloaded!`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          AI Rules & Context
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="w-4 h-4" />
          <AlertDescription>
            Configure AI context files for better assistance. <strong>.cursorrules</strong> works with Cursor, 
            while <strong>CLAUDE.md</strong> provides project context for Claude.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'cursor' | 'claude')} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cursor" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              .cursorrules
            </TabsTrigger>
            <TabsTrigger value="claude" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              CLAUDE.md
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cursor" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">Cursor AI Assistant Rules</h3>
                <p className="text-sm text-muted-foreground">
                  Configure how Cursor's AI understands your project
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyToClipboard(editingCursorRules, '.cursorrules')}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(editingCursorRules, '.cursorrules')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button
                  onClick={handleSaveCursorRules}
                  disabled={cursorRulesMutation.isPending}
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>

            {cursorRulesLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <Textarea
                value={editingCursorRules}
                onChange={(e) => setEditingCursorRules(e.target.value)}
                placeholder="Enter your Cursor AI rules here..."
                className="min-h-[300px] font-mono text-sm"
              />
            )}
          </TabsContent>

          <TabsContent value="claude" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">Claude Project Context</h3>
                <p className="text-sm text-muted-foreground">
                  Markdown file explaining your project structure and guidelines
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyToClipboard(editingClaudeMd, 'CLAUDE.md')}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(editingClaudeMd, 'CLAUDE.md')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button
                  onClick={handleSaveClaudeMd}
                  disabled={claudeMdMutation.isPending}
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>

            {claudeMdLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <Textarea
                value={editingClaudeMd}
                onChange={(e) => setEditingClaudeMd(e.target.value)}
                placeholder="Enter your Claude project context here..."
                className="min-h-[300px] font-mono text-sm"
              />
            )}

            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                This file helps Claude understand your project. Include project structure, 
                coding conventions, key concepts, and any important context.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}