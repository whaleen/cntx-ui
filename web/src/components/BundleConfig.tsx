import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Trash2, Plus, Save, Eye, AlertTriangle, Settings, X } from 'lucide-react'
import { useButtonFeedback } from '../hooks/useButtonFeedback'
import { getButtonIcon, getButtonClassName } from '../utils/buttonHelpers'
import { toast } from '@/lib/toast'

// Extend Window interface for timeout
declare global {
  interface Window {
    patternChangeTimeout?: NodeJS.Timeout
  }
}

interface BundleConfig {
  bundles: Record<string, string[]>
}

interface Bundle {
  name: string
  files: string[]
  size: number
}

const fetchConfig = async (): Promise<BundleConfig> => {
  const response = await fetch('http://localhost:3333/api/config')
  if (!response.ok) throw new Error('Failed to fetch config')
  return response.json()
}

const fetchBundles = async (): Promise<Bundle[]> => {
  const response = await fetch('http://localhost:3333/api/bundles')
  if (!response.ok) throw new Error('Failed to fetch bundles')
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

export function BundleConfig() {
  const queryClient = useQueryClient()
  const [editingConfig, setEditingConfig] = useState<BundleConfig | null>(null)
  const [testingPattern, setTestingPattern] = useState('')
  const [testResults, setTestResults] = useState<string[]>([])
  const [pasteConfigText, setPasteConfigText] = useState('')

  // New bundle creation state
  const [showAddBundle, setShowAddBundle] = useState(false)
  const [newBundleName, setNewBundleName] = useState('')
  const [newBundlePatterns, setNewBundlePatterns] = useState('**/*')

  const { setButtonState, getButtonState, isLoading } = useButtonFeedback()

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig
  })

  const { data: bundles } = useQuery({
    queryKey: ['bundles'],
    queryFn: fetchBundles,
    refetchInterval: 5000
  })

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      setEditingConfig(null)
      setButtonState('save', 'success')
      toast.success('Configuration saved successfully!')
    },
    onError: (error) => {
      setButtonState('save', 'error')
      toast.error(`Failed to save config: ${error.message}`)
    }
  })

  useEffect(() => {
    if (config && !editingConfig) {
      setEditingConfig(config)
    }
  }, [config])

  const handleSave = () => {
    if (editingConfig) {
      setButtonState('save', 'loading')
      saveMutation.mutate(editingConfig)
    }
  }

  const handleTestPattern = async () => {
    if (!testingPattern.trim()) return

    setButtonState('test', 'loading')
    try {
      const results = await testPattern(testingPattern)
      setTestResults(results)
      setButtonState('test', 'success')
      toast.success(`Pattern matched ${results.length} files`)
    } catch (error) {
      console.error('Pattern test failed:', error)
      setTestResults([])
      setButtonState('test', 'error')
      toast.error('Failed to test pattern')
    }
  }

  const handlePasteConfig = async () => {
    if (!pasteConfigText.trim()) return

    setButtonState('paste', 'loading')
    try {
      const parsed = JSON.parse(pasteConfigText)
      if (!parsed.bundles || typeof parsed.bundles !== 'object') {
        throw new Error('Configuration must have a "bundles" object')
      }

      // Ensure master bundle exists
      if (!parsed.bundles.master) {
        parsed.bundles.master = ['**/*']
      }

      setEditingConfig({
        bundles: Object.fromEntries(
          Object.entries(parsed.bundles).map(([name, patterns]) => [
            name,
            Array.isArray(patterns) ? patterns : [patterns]
          ])
        )
      })

      const bundleCount = Object.keys(parsed.bundles).length
      setPasteConfigText('')
      setButtonState('paste', 'success')
      toast.success(`Applied ${bundleCount} bundles successfully`)
    } catch (error) {
      setButtonState('paste', 'error')
      toast.error(`Invalid configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Handle adding new bundle - immediately save to system
  const handleAddBundle = async () => {
    if (!editingConfig || !newBundleName.trim()) return

    const trimmedName = newBundleName.trim()

    if (editingConfig.bundles[trimmedName]) {
      toast.error(`Bundle "${trimmedName}" already exists`)
      return
    }

    // Parse patterns (split by newlines, filter empty)
    const patterns = newBundlePatterns
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)

    if (patterns.length === 0) {
      toast.error('At least one pattern is required')
      return
    }

    const newConfig = {
      ...editingConfig,
      bundles: {
        ...editingConfig.bundles,
        [trimmedName]: patterns
      }
    }

    try {
      // Immediately save to system
      setButtonState('create-bundle', 'loading')
      await saveConfig(newConfig)

      // Update local state
      setEditingConfig(newConfig)

      // Reset form
      setNewBundleName('')
      setNewBundlePatterns('**/*')
      setShowAddBundle(false)

      // Force refresh ALL bundle-related queries
      await queryClient.invalidateQueries({ queryKey: ['config'] })
      await queryClient.invalidateQueries({ queryKey: ['bundles'] })
      await queryClient.invalidateQueries({ queryKey: ['bundle-visibility-stats'] })

      // Also force refetch to ensure immediate update
      queryClient.refetchQueries({ queryKey: ['bundles'] })

      setButtonState('create-bundle', 'success')
      toast.success(`Bundle "${trimmedName}" created and saved!`)
    } catch (error) {
      setButtonState('create-bundle', 'error')
      toast.error(`Failed to create bundle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDeleteBundle = async (bundleName: string) => {
    if (!editingConfig || bundleName === 'master') return
    if (!confirm(`Delete bundle "${bundleName}"?`)) return

    try {
      setButtonState(`delete-${bundleName}`, 'loading')

      // Create new config without the deleted bundle
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [bundleName]: deleted, ...rest } = editingConfig.bundles
      const newConfig = { ...editingConfig, bundles: rest }

      // Immediately save to system
      await saveConfig(newConfig)

      // Update local state
      setEditingConfig(newConfig)

      // Wait a moment for server to process
      await new Promise(resolve => setTimeout(resolve, 500))

      // Force clear all cache and refetch
      queryClient.removeQueries({ queryKey: ['bundles'] })
      queryClient.removeQueries({ queryKey: ['config'] })
      queryClient.removeQueries({ queryKey: ['bundle-visibility-stats'] })

      // Force immediate refetch
      await queryClient.refetchQueries({ queryKey: ['bundles'] })
      await queryClient.refetchQueries({ queryKey: ['config'] })

      setButtonState(`delete-${bundleName}`, 'success')
      toast.success(`Bundle "${bundleName}" deleted successfully!`)
    } catch (error) {
      setButtonState(`delete-${bundleName}`, 'error')
      toast.error(`Failed to delete bundle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handlePatternChange = async (bundleName: string, index: number, newPattern: string) => {
    if (!editingConfig) return

    const newPatterns = [...editingConfig.bundles[bundleName]]
    newPatterns[index] = newPattern
    const newConfig = {
      ...editingConfig,
      bundles: { ...editingConfig.bundles, [bundleName]: newPatterns }
    }

    setEditingConfig(newConfig)

    // Debounced save - only save after user stops typing for 1 second
    clearTimeout(window.patternChangeTimeout)
    window.patternChangeTimeout = setTimeout(async () => {
      try {
        await saveConfig(newConfig)
        queryClient.invalidateQueries({ queryKey: ['config'] })
        queryClient.invalidateQueries({ queryKey: ['bundles'] })
      } catch (error) {
        toast.error(`Failed to save pattern change: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }, 1000)
  }

  const handleAddPattern = async (bundleName: string) => {
    if (!editingConfig) return

    const newConfig = {
      ...editingConfig,
      bundles: {
        ...editingConfig.bundles,
        [bundleName]: [...editingConfig.bundles[bundleName], '']
      }
    }

    try {
      await saveConfig(newConfig)
      setEditingConfig(newConfig)
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('Pattern added')
    } catch (error) {
      toast.error(`Failed to add pattern: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRemovePattern = async (bundleName: string, index: number) => {
    if (!editingConfig || editingConfig.bundles[bundleName].length === 1) return

    const newPatterns = editingConfig.bundles[bundleName].filter((_, i) => i !== index)
    const newConfig = {
      ...editingConfig,
      bundles: { ...editingConfig.bundles, [bundleName]: newPatterns }
    }

    try {
      await saveConfig(newConfig)
      setEditingConfig(newConfig)
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('Pattern removed')
    } catch (error) {
      toast.error(`Failed to remove pattern: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getBundleStats = (bundleName: string) => {
    const bundle = bundles?.find(b => b.name === bundleName)
    return bundle ? { files: bundle.files.length, size: bundle.size } : { files: 0, size: 0 }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  if (configLoading) return <div>Loading configuration...</div>
  if (!editingConfig) return <div>No configuration found</div>

  const hasChanges = JSON.stringify(config) !== JSON.stringify(editingConfig)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Bundle Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Define patterns for each bundle. Use glob patterns like *.js, src/**/*.tsx, etc.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setEditingConfig(config || null)}
            disabled={!hasChanges}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isLoading('save')}
            className={getButtonClassName(getButtonState('save'))}
          >
            {getButtonIcon(getButtonState('save'), <Save className="w-4 h-4" />)}
            <span className="ml-1">Save Changes</span>
          </Button>
        </div>
      </div>

      {/* Paste Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Paste Bundle Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste bundle configuration JSON here..."
            value={pasteConfigText}
            onChange={(e) => setPasteConfigText(e.target.value)}
            className="min-h-32 font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={handlePasteConfig}
              disabled={!pasteConfigText.trim() || isLoading('paste')}
              className={getButtonClassName(getButtonState('paste'))}
            >
              {getButtonIcon(getButtonState('paste'), <Settings className="w-4 h-4" />)}
              <span className="ml-1">Apply Configuration</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setPasteConfigText('')}
              disabled={!pasteConfigText.trim()}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pattern Tester */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Pattern Tester
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Test a glob pattern (e.g., src/**/*.ts)"
              value={testingPattern}
              onChange={(e) => setTestingPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestPattern()}
            />
            <Button
              onClick={handleTestPattern}
              disabled={!testingPattern.trim() || isLoading('test')}
              className={getButtonClassName(getButtonState('test'))}
            >
              {getButtonIcon(getButtonState('test'), <Eye className="w-4 h-4" />)}
              <span className="ml-1">Test</span>
            </Button>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Matches {testResults.length} files:
              </div>
              <div className="max-h-40 overflow-y-auto bg-muted p-3 rounded-md">
                {testResults.slice(0, 20).map((file, i) => (
                  <div key={i} className="text-sm font-mono">{file}</div>
                ))}
                {testResults.length > 20 && (
                  <div className="text-sm text-muted-foreground">
                    ... and {testResults.length - 20} more files
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bundle Enhancement Options - NEW SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Bundle Enhancement Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Structure & Context */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Structure & Context</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input type="checkbox" className="rounded" />
                  <div className="flex-1">
                    <div className="text-sm">Directory Tree</div>
                    <div className="text-xs text-muted-foreground">Include project structure overview</div>
                  </div>
                  <Badge variant="outline" className="text-xs">+10%</Badge>
                </label>

                <label className="flex items-center gap-3">
                  <input type="checkbox" className="rounded" />
                  <div className="flex-1">
                    <div className="text-sm">File Types</div>
                    <div className="text-xs text-muted-foreground">Auto-detect file purposes</div>
                  </div>
                  <Badge variant="outline" className="text-xs">+5%</Badge>
                </label>

                <label className="flex items-center gap-3">
                  <input type="checkbox" className="rounded" />
                  <div className="flex-1">
                    <div className="text-sm">Dependencies</div>
                    <div className="text-xs text-muted-foreground">Import/export mapping</div>
                  </div>
                  <Badge variant="outline" className="text-xs">+25%</Badge>
                </label>
              </div>
            </div>

            {/* AI Instructions */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">AI Instructions</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <div className="flex-1">
                    <div className="text-sm">Bundle Purpose</div>
                    <div className="text-xs text-muted-foreground">What this bundle is for</div>
                  </div>
                  <Badge variant="outline" className="text-xs">+2%</Badge>
                </label>

                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <div className="flex-1">
                    <div className="text-sm">Cursor Rules</div>
                    <div className="text-xs text-muted-foreground">Include .cursorrules content</div>
                  </div>
                  <Badge variant="outline" className="text-xs">+15%</Badge>
                </label>

                <label className="flex items-center gap-3">
                  <input type="checkbox" className="rounded" />
                  <div className="flex-1">
                    <div className="text-sm">Custom Instructions</div>
                    <div className="text-xs text-muted-foreground">Bundle-specific AI guidance</div>
                  </div>
                  <Badge variant="outline" className="text-xs">+5%</Badge>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-[color:var(--color-info)]/5 p-3 rounded-md">
            <div className="text-sm text-[color:var(--color-info)]">
              <strong>Coming Soon:</strong> These enhancement options will add rich context to your bundles,
              making them more useful for AI agents. Enable features based on your needs vs. bundle size preferences.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bundle Configurations */}
      <div className="space-y-4">
        {Object.entries(editingConfig.bundles).map(([bundleName, patterns]) => {
          const stats = getBundleStats(bundleName)
          const isLarge = stats.size > 10 * 1024 * 1024

          return (
            <Card key={bundleName} className={isLarge ? 'border-[color:var(--color-warning)]' : ''}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <CardTitle>{bundleName}</CardTitle>
                    <Badge variant="outline">
                      {stats.files} files • {formatSize(stats.size)}
                    </Badge>
                    {isLarge && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Large
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPattern(bundleName)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Pattern
                    </Button>
                    {bundleName !== 'master' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBundle(bundleName)}
                        disabled={isLoading(`delete-${bundleName}`)}
                        className={getButtonClassName(getButtonState(`delete-${bundleName}`))}
                      >
                        {getButtonIcon(getButtonState(`delete-${bundleName}`), <Trash2 className="w-4 h-4" />)}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {patterns.map((pattern, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={pattern}
                      onChange={(e) => handlePatternChange(bundleName, index, e.target.value)}
                      placeholder="Glob pattern (e.g., src/**/*.ts)"
                      className="font-mono"
                    />
                    {patterns.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemovePattern(bundleName, index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add New Bundle */}
      <Card>
        <CardContent className="pt-6">
          {!showAddBundle ? (
            <Button
              variant="outline"
              onClick={() => setShowAddBundle(true)}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Bundle
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Create New Bundle</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddBundle(false)
                    setNewBundleName('')
                    setNewBundlePatterns('**/*')
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Bundle Name</label>
                  <Input
                    placeholder="e.g., frontend, backend, tests"
                    value={newBundleName}
                    onChange={(e) => setNewBundleName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Patterns (one per line)</label>
                  <Textarea
                    placeholder="src/components/**/*&#10;src/pages/**/*&#10;*.jsx"
                    value={newBundlePatterns}
                    onChange={(e) => setNewBundlePatterns(e.target.value)}
                    className="font-mono text-sm"
                    rows={4}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Examples: <code>src/**/*.ts</code>, <code>**/*.test.*</code>, <code>docs/**/*</code>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddBundle}
                  disabled={!newBundleName.trim() || isLoading('create-bundle')}
                  className={getButtonClassName(getButtonState('create-bundle'))}
                >
                  {getButtonIcon(getButtonState('create-bundle'), <Plus className="w-4 h-4" />)}
                  <span className="ml-1">Create Bundle</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddBundle(false)
                    setNewBundleName('')
                    setNewBundlePatterns('**/*')
                  }}
                  disabled={isLoading('create-bundle')}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
