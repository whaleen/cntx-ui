import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Plus, Trash2, Eye, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'

interface BundleConfig {
  bundles: Record<string, string[]>
}

interface ProjectFile {
  path: string
  type: string
  size: number
}

const fetchConfig = async (): Promise<BundleConfig> => {
  const response = await fetch('http://localhost:3333/api/config')
  if (!response.ok) throw new Error('Failed to fetch config')
  return response.json()
}

const saveConfig = async (config: BundleConfig): Promise<void> => {
  const response = await fetch('http://localhost:3333/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  if (!response.ok) throw new Error('Failed to save config')
}

const fetchProjectFiles = async (): Promise<ProjectFile[]> => {
  const response = await fetch('http://localhost:3333/api/files')
  if (!response.ok) throw new Error('Failed to fetch files')
  return response.json()
}

const testPattern = async (pattern: string): Promise<string[]> => {
  const response = await fetch('http://localhost:3333/api/test-pattern', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern })
  })
  if (!response.ok) throw new Error('Failed to test pattern')
  return response.json()
}

export function EnhancedBundleConfig() {
  const queryClient = useQueryClient()
  const [editingBundle, setEditingBundle] = useState<string | null>(null)
  const [showCreateBundle, setShowCreateBundle] = useState(false)
  const [createBundleStep, setCreateBundleStep] = useState<'name' | 'files' | 'patterns'>('name')
  
  // Bundle creation state
  const [newBundleName, setNewBundleName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [generatedPatterns, setGeneratedPatterns] = useState<string[]>([])
  
  // Pattern testing
  const [testingPattern, setTestingPattern] = useState('')
  const [testResults, setTestResults] = useState<string[]>([])

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig
  })

  const { data: projectFiles, isLoading: filesLoading } = useQuery({
    queryKey: ['project-files'],
    queryFn: fetchProjectFiles
  })

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      setEditingBundle(null)
      setShowCreateBundle(false)
      setNewBundleName('')
      setSelectedFiles(new Set())
      setGeneratedPatterns([])
      setCreateBundleStep('name')
      toast.success('Bundle configuration saved!')
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`)
    }
  })

  // Generate patterns from selected files
  const generatePatternsFromFiles = (files: string[]) => {
    const patterns: string[] = []
    const directories = new Set<string>()
    
    files.forEach(file => {
      const dir = file.split('/').slice(0, -1).join('/')
      if (dir) directories.add(dir)
    })
    
    // Create patterns for common directory structures
    directories.forEach(dir => {
      const filesInDir = files.filter(f => f.startsWith(dir + '/'))
      if (filesInDir.length > 1) {
        patterns.push(`${dir}/**/*`)
      }
    })
    
    // Add individual files that don't fit patterns
    files.forEach(file => {
      const matchedByPattern = patterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
        return regex.test(file)
      })
      if (!matchedByPattern) {
        patterns.push(file)
      }
    })
    
    return patterns.length > 0 ? patterns : files
  }

  const handleCreateBundle = () => {
    if (!config || !newBundleName.trim()) return
    
    const patterns = generatedPatterns.length > 0 ? generatedPatterns : Array.from(selectedFiles)
    
    const updatedConfig = {
      ...config,
      bundles: {
        ...config.bundles,
        [newBundleName]: patterns
      }
    }
    
    saveMutation.mutate(updatedConfig)
  }

  const handleDeleteBundle = (bundleName: string) => {
    if (!config) return
    
    const { [bundleName]: deleted, ...remainingBundles } = config.bundles
    const updatedConfig = {
      ...config,
      bundles: remainingBundles
    }
    
    saveMutation.mutate(updatedConfig)
  }

  const handlePatternChange = (bundleName: string, patterns: string[]) => {
    if (!config) return
    
    const updatedConfig = {
      ...config,
      bundles: {
        ...config.bundles,
        [bundleName]: patterns
      }
    }
    
    saveMutation.mutate(updatedConfig)
  }

  const handleTestPattern = async () => {
    if (!testingPattern.trim()) return
    
    try {
      const results = await testPattern(testingPattern)
      setTestResults(results)
    } catch (error) {
      toast.error('Failed to test pattern')
    }
  }

  const handleFileSelection = (filePath: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath)
    } else {
      newSelected.add(filePath)
    }
    setSelectedFiles(newSelected)
    
    // Auto-generate patterns when files are selected
    if (newSelected.size > 0) {
      const patterns = generatePatternsFromFiles(Array.from(newSelected))
      setGeneratedPatterns(patterns)
    } else {
      setGeneratedPatterns([])
    }
  }

  if (configLoading || filesLoading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Bundle Configuration
          <Button
            onClick={() => setShowCreateBundle(true)}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Bundle
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create Bundle Modal */}
        {showCreateBundle && (
          <Card className="border-2 border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-lg">Create New Bundle</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={createBundleStep} onValueChange={(value) => setCreateBundleStep(value as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="name">1. Name</TabsTrigger>
                  <TabsTrigger value="files" disabled={!newBundleName.trim()}>2. Select Files</TabsTrigger>
                  <TabsTrigger value="patterns" disabled={selectedFiles.size === 0}>3. Review</TabsTrigger>
                </TabsList>

                <TabsContent value="name" className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Bundle Name</label>
                    <Input
                      placeholder="e.g., frontend, api, components"
                      value={newBundleName}
                      onChange={(e) => setNewBundleName(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={() => setCreateBundleStep('files')}
                    disabled={!newBundleName.trim()}
                  >
                    Next: Select Files
                  </Button>
                </TabsContent>

                <TabsContent value="files" className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium">Select Files for "{newBundleName}"</label>
                      <Badge variant="outline">{selectedFiles.size} selected</Badge>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-1">
                      {projectFiles?.map(file => (
                        <div
                          key={file.path}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => handleFileSelection(file.path)}
                        >
                          {selectedFiles.has(file.path) ? (
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm font-mono flex-1">{file.path}</span>
                          <Badge variant="outline" className="text-xs">{file.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCreateBundleStep('name')}>
                      Back
                    </Button>
                    <Button 
                      onClick={() => setCreateBundleStep('patterns')}
                      disabled={selectedFiles.size === 0}
                    >
                      Next: Review Patterns
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="patterns" className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Generated Patterns</label>
                    <div className="space-y-2 mt-2">
                      {generatedPatterns.map((pattern, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={pattern}
                            onChange={(e) => {
                              const newPatterns = [...generatedPatterns]
                              newPatterns[index] = e.target.value
                              setGeneratedPatterns(newPatterns)
                            }}
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newPatterns = generatedPatterns.filter((_, i) => i !== index)
                              setGeneratedPatterns(newPatterns)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setGeneratedPatterns([...generatedPatterns, '**/*'])}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Pattern
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCreateBundleStep('files')}>
                      Back
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateBundle(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateBundle} disabled={saveMutation.isPending}>
                      Create Bundle
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Existing Bundles */}
        <div className="space-y-4">
          {config && Object.entries(config.bundles).map(([bundleName, patterns]) => (
            <div key={bundleName} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{bundleName}</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingBundle(editingBundle === bundleName ? null : bundleName)}
                  >
                    {editingBundle === bundleName ? 'Done' : 'Edit'}
                  </Button>
                  {bundleName !== 'master' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBundle(bundleName)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {editingBundle === bundleName ? (
                <div className="space-y-2">
                  {patterns.map((pattern, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={pattern}
                        onChange={(e) => {
                          const newPatterns = [...patterns]
                          newPatterns[index] = e.target.value
                          handlePatternChange(bundleName, newPatterns)
                        }}
                        placeholder="e.g., src/**/*.ts"
                        className="font-mono text-sm"
                      />
                      {patterns.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newPatterns = patterns.filter((_, i) => i !== index)
                            handlePatternChange(bundleName, newPatterns)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePatternChange(bundleName, [...patterns, '**/*'])}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Pattern
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {patterns.map((pattern, index) => (
                    <Badge key={index} variant="secondary" className="font-mono text-xs">
                      {pattern}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pattern Tester */}
        <Card>
          <CardHeader>
            <CardTitle>Test a Pattern</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., src/**/*.ts"
                value={testingPattern}
                onChange={(e) => setTestingPattern(e.target.value)}
                className="font-mono"
              />
              <Button onClick={handleTestPattern}>
                <Eye className="w-4 h-4 mr-1" />
                Test
              </Button>
            </div>
            
            {testResults.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground mb-2">
                  Found {testResults.length} files:
                </p>
                <div className="max-h-32 overflow-y-auto text-xs space-y-1 bg-muted/50 p-2 rounded font-mono">
                  {testResults.slice(0, 20).map((file, index) => (
                    <div key={index}>{file}</div>
                  ))}
                  {testResults.length > 20 && (
                    <div className="text-muted-foreground">
                      ... and {testResults.length - 20} more files
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}