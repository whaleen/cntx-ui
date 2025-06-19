import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Plus, Save, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface BundleConfig {
  bundles: Record<string, string[]>
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

const testPattern = async (pattern: string): Promise<string[]> => {
  const response = await fetch('http://localhost:3333/api/test-pattern', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern })
  })
  if (!response.ok) throw new Error('Failed to test pattern')
  return response.json()
}

export function SimpleBundleConfig() {
  const queryClient = useQueryClient()
  const [editingBundle, setEditingBundle] = useState<string | null>(null)
  const [newBundleName, setNewBundleName] = useState('')
  const [showAddBundle, setShowAddBundle] = useState(false)
  const [testingPattern, setTestingPattern] = useState('')
  const [testResults, setTestResults] = useState<string[]>([])

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig
  })

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      setEditingBundle(null)
      toast.success('Configuration saved!')
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`)
    }
  })

  const handleSave = () => {
    if (!config) return
    saveMutation.mutate(config)
  }

  const handleAddBundle = () => {
    if (!config || !newBundleName.trim()) return
    
    const updatedConfig = {
      ...config,
      bundles: {
        ...config.bundles,
        [newBundleName]: ['**/*']
      }
    }
    
    saveMutation.mutate(updatedConfig)
    setNewBundleName('')
    setShowAddBundle(false)
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

  if (isLoading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Bundle Configuration
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            size="sm"
          >
            <Save className="w-4 h-4 mr-1" />
            Save All
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteBundle(bundleName)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
                    <Badge key={index} variant="secondary">
                      {pattern}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add New Bundle */}
        {showAddBundle ? (
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="space-y-3">
              <Input
                placeholder="Bundle name"
                value={newBundleName}
                onChange={(e) => setNewBundleName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handleAddBundle} disabled={!newBundleName.trim()}>
                  Create Bundle
                </Button>
                <Button variant="outline" onClick={() => setShowAddBundle(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowAddBundle(true)}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add New Bundle
          </Button>
        )}

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
                <div className="max-h-32 overflow-y-auto text-xs space-y-1 bg-muted/50 p-2 rounded">
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