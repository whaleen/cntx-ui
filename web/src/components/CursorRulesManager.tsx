// Updated CursorRulesManager.tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Alert, AlertDescription } from './ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Save, RefreshCw, Copy, Download, Upload, Sparkles, FileText, Info } from 'lucide-react'
import { useButtonFeedback } from '../hooks/useButtonFeedback'
import { getButtonIcon, getButtonClassName } from '../utils/buttonHelpers'
import { toast } from '@/lib/toast'

interface CursorRulesTemplates {
  react: string
  node: string
  general: string
}

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

const fetchTemplates = async (): Promise<CursorRulesTemplates> => {
  const response = await fetch('http://localhost:3333/api/cursor-rules/templates')
  if (!response.ok) throw new Error('Failed to fetch templates')
  return response.json()
}

export function CursorRulesManager() {
  const queryClient = useQueryClient()
  const [editingRules, setEditingRules] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  const { setButtonState, getButtonState, isLoading } = useButtonFeedback()

  const { data: currentRules, isLoading: rulesLoading } = useQuery({
    queryKey: ['cursor-rules'],
    queryFn: fetchCursorRules
  })

  const { data: templates } = useQuery({
    queryKey: ['cursor-templates'],
    queryFn: fetchTemplates
  })

  const saveMutation = useMutation({
    mutationFn: saveCursorRules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cursor-rules'] })
      setButtonState('save', 'success')
      toast.success('Cursor rules saved successfully!')
    },
    onError: (error) => {
      setButtonState('save', 'error')
      toast.error(`Failed to save cursor rules: ${error.message}`)
    }
  })

  useEffect(() => {
    if (currentRules && !editingRules) {
      setEditingRules(currentRules)
    }
  }, [currentRules])

  const handleSave = () => {
    if (editingRules) {
      setButtonState('save', 'loading')
      saveMutation.mutate(editingRules)
    }
  }

  const handleReset = () => {
    setEditingRules(currentRules || '')
    toast.info('Reset to last saved version')
  }

  const handleLoadTemplate = (templateType: keyof CursorRulesTemplates) => {
    if (templates && templates[templateType]) {
      setEditingRules(templates[templateType])
      setSelectedTemplate(templateType)
      toast.success(`Loaded ${templateType} template`)
    }
  }

  const copyToClipboard = async () => {
    if (!editingRules) return

    setButtonState('copy', 'loading')
    try {
      await navigator.clipboard.writeText(editingRules)
      setButtonState('copy', 'success')
      toast.success('Cursor rules copied to clipboard!')
    } catch (error) {
      setButtonState('copy', 'error')
      toast.error('Failed to copy to clipboard')
    }
  }

  const downloadRules = () => {
    setButtonState('download', 'loading')
    try {
      const blob = new Blob([editingRules], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '.cursorrules'
      a.click()
      URL.revokeObjectURL(url)
      setButtonState('download', 'success')
      toast.success('Cursor rules downloaded!')
    } catch (error) {
      setButtonState('download', 'error')
      toast.error('Failed to download file')
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setButtonState('upload', 'loading')
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setEditingRules(content)
      setButtonState('upload', 'success')
      toast.success('Cursor rules uploaded successfully!')
    }
    reader.onerror = () => {
      setButtonState('upload', 'error')
      toast.error('Failed to read file')
    }
    reader.readAsText(file)
  }

  if (rulesLoading) return <div>Loading cursor rules...</div>

  const hasChanges = currentRules !== editingRules
  const wordCount = editingRules.split(/\s+/).filter(word => word.length > 0).length
  const lineCount = editingRules.split('\n').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Cursor Rules Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure AI assistant behavior and project context for Cursor IDE
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isLoading('save')}
            className={`bg-[color:var(--color-type-hooks)] hover:bg-[color:var(--color-type-hooks)]/80 ${getButtonClassName(getButtonState('save'))}`}
          >
            {getButtonIcon(getButtonState('save'), <Save className="w-4 h-4" />)}
            <span className="ml-1">Save Rules</span>
          </Button>
        </div>
      </div>

      {/* Status Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {lineCount} lines • {wordCount} words
                </span>
              </div>
              {currentRules && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[color:var(--color-success)]">.cursorrules file exists</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                disabled={isLoading('copy')}
                className={getButtonClassName(getButtonState('copy'))}
              >
                {getButtonIcon(getButtonState('copy'), <Copy className="w-4 h-4" />)}
                <span className="ml-1">Copy</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadRules}
                disabled={isLoading('download')}
                className={getButtonClassName(getButtonState('download'))}
              >
                {getButtonIcon(getButtonState('download'), <Download className="w-4 h-4" />)}
                <span className="ml-1">Download</span>
              </Button>
              <label className="cursor-pointer">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className={getButtonClassName(getButtonState('upload'))}
                >
                  <span>
                    {getButtonIcon(getButtonState('upload'), <Upload className="w-4 h-4" />)}
                    <span className="ml-1">Upload</span>
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".cursorrules,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="editor" className="space-y-6">
        <TabsList>
          <TabsTrigger value="editor">Rules Editor</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="help">Help & Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="editor">
          <Card>
            <CardHeader>
              <CardTitle>Edit Cursor Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasChanges && (
                <Alert className="border-[color:var(--color-warning)]/20 bg-[color:var(--color-warning)]/5">
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    You have unsaved changes. Click "Save Rules" to apply them to your .cursorrules file.
                  </AlertDescription>
                </Alert>
              )}

              <Textarea
                value={editingRules}
                onChange={(e) => setEditingRules(e.target.value)}
                placeholder="Enter your cursor rules here..."
                className="min-h-96 font-mono text-sm"
              />

              {selectedTemplate && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Template: {selectedTemplate}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTemplate('')}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a template that matches your project type. You can customize it after loading.
                </p>
                <div className="grid gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleLoadTemplate('react')}
                    className="justify-start h-auto p-4"
                  >
                    <div className="text-left">
                      <div className="font-medium">React Application</div>
                      <div className="text-sm text-muted-foreground">
                        Modern React with TypeScript, hooks, and Tailwind CSS
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleLoadTemplate('node')}
                    className="justify-start h-auto p-4"
                  >
                    <div className="text-left">
                      <div className="font-medium">Node.js Backend</div>
                      <div className="text-sm text-muted-foreground">
                        Express/Fastify backend with ES modules and TypeScript
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleLoadTemplate('general')}
                    className="justify-start h-auto p-4"
                  >
                    <div className="text-left">
                      <div className="font-medium">General Project</div>
                      <div className="text-sm text-muted-foreground">
                        Basic template for any type of project
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="help">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>What are Cursor Rules?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Cursor rules (.cursorrules) provide context and guidelines to AI assistants like Cursor IDE's AI.
                  They help the AI understand your project structure, coding preferences, and best practices.
                </p>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-2">Best Practices</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Include project context and technology stack</li>
                      <li>Specify coding standards and naming conventions</li>
                      <li>Document file organization patterns</li>
                      <li>Mention important dependencies and frameworks</li>
                      <li>Include team preferences and architectural decisions</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Example Sections</h4>
                    <div className="bg-muted/50 p-3 rounded text-xs font-mono">
                      # Project Context<br />
                      # Development Guidelines<br />
                      # Code Style<br />
                      # File Organization<br />
                      # Bundle Context<br />
                      # AI Assistant Instructions
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration with cntx-ui</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Your cursor rules automatically include information about your cntx-ui bundle configuration,
                  helping AI assistants understand your project structure and file organization.
                </p>

                <Alert>
                  <Sparkles className="w-4 h-4" />
                  <AlertDescription>
                    When you change your bundle configuration, consider updating your cursor rules
                    to reflect the new project structure and help AI assistants provide better suggestions.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
