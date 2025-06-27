import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import {
  Eye,
  EyeOff,
  Search,
  Plus,
  Trash2,
  RotateCcw,
  FileText,
  Settings,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react'
import { toast } from '@/lib/toast'

interface FileWithVisibility {
  path: string
  size: number
  modified: string
  visible: boolean
  globallyHidden: boolean
  bundleHidden: boolean
  inBundles: string[]
  matchesIgnorePattern: boolean
}

interface IgnorePattern {
  pattern: string
  active: boolean
}

interface IgnorePatterns {
  system: IgnorePattern[]
  user: IgnorePattern[]
  file: IgnorePattern[]
}

interface BundleStats {
  total: number
  visible: number
  hidden: number
  patterns: string[]
}

// API functions
const fetchFilesWithVisibility = async (bundleName: string | null = null): Promise<FileWithVisibility[]> => {
  const url = bundleName
    ? `http://localhost:3333/api/files-with-visibility?bundle=${bundleName}`
    : 'http://localhost:3333/api/files-with-visibility'
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch files')
  return response.json()
}

const fetchIgnorePatterns = async (): Promise<IgnorePatterns> => {
  const response = await fetch('http://localhost:3333/api/ignore-patterns')
  if (!response.ok) throw new Error('Failed to fetch ignore patterns')
  return response.json()
}

const fetchBundleVisibilityStats = async (): Promise<Record<string, BundleStats>> => {
  const response = await fetch('http://localhost:3333/api/bundle-visibility-stats')
  if (!response.ok) throw new Error('Failed to fetch bundle stats')
  return response.json()
}

const toggleFileVisibility = async ({ filePath, bundleName = null, forceHide = null }: {
  filePath: string
  bundleName?: string | null
  forceHide?: boolean | null
}) => {
  const response = await fetch('http://localhost:3333/api/hidden-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'toggle',
      filePath,
      bundleName,
      forceHide
    })
  })
  if (!response.ok) throw new Error('Failed to toggle file visibility')
  return response.json()
}

const bulkToggleVisibility = async ({ filePaths, bundleName = null, forceHide }: {
  filePaths: string[]
  bundleName?: string | null
  forceHide: boolean
}) => {
  const response = await fetch('http://localhost:3333/api/hidden-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'bulk-toggle',
      filePaths,
      bundleName,
      forceHide
    })
  })
  if (!response.ok) throw new Error('Failed to bulk toggle visibility')
  return response.json()
}

const manageIgnorePattern = async ({ action, pattern }: {
  action: 'add' | 'remove' | 'toggle-system'
  pattern: string
}) => {
  const response = await fetch('http://localhost:3333/api/ignore-patterns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, pattern })
  })
  if (!response.ok) throw new Error('Failed to manage ignore pattern')
  return response.json()
}

const resetHiddenFiles = async ({ scope, bundleName = null }: {
  scope: 'global' | 'bundle' | 'all'
  bundleName?: string | null
}) => {
  const response = await fetch('http://localhost:3333/api/reset-hidden-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, bundleName })
  })
  if (!response.ok) throw new Error('Failed to reset hidden files')
  return response.json()
}

export function HiddenFilesManager() {
  const queryClient = useQueryClient()
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [filterBy, setFilterBy] = useState('all') // all, hidden, visible
  const [newPattern, setNewPattern] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])

  // Queries
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['files-with-visibility', selectedBundle],
    queryFn: () => fetchFilesWithVisibility(selectedBundle),
    refetchInterval: 5000
  })

  const { data: ignorePatterns = { system: [], user: [], file: [] }, isLoading: patternsLoading } = useQuery({
    queryKey: ['ignore-patterns'],
    queryFn: fetchIgnorePatterns,
    refetchInterval: 10000
  })

  const { data: bundleStats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ['bundle-visibility-stats'],
    queryFn: fetchBundleVisibilityStats,
    refetchInterval: 5000
  })

  // Mutations
  const toggleFileMutation = useMutation({
    mutationFn: toggleFileVisibility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files-with-visibility'] })
      queryClient.invalidateQueries({ queryKey: ['bundle-visibility-stats'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('File visibility updated')
    },
    onError: (error: Error) => toast.error(`Failed to update file visibility: ${error.message}`)
  })

  const bulkToggleMutation = useMutation({
    mutationFn: bulkToggleVisibility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files-with-visibility'] })
      queryClient.invalidateQueries({ queryKey: ['bundle-visibility-stats'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      setSelectedFiles([])
      toast.success('Bulk visibility update completed')
    },
    onError: (error: Error) => toast.error(`Failed to bulk update visibility: ${error.message}`)
  })

  const patternMutation = useMutation({
    mutationFn: manageIgnorePattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ignore-patterns'] })
      queryClient.invalidateQueries({ queryKey: ['files-with-visibility'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('Ignore pattern updated')
    },
    onError: (error: Error) => toast.error(`Failed to update ignore pattern: ${error.message}`)
  })

  const resetMutation = useMutation({
    mutationFn: resetHiddenFiles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files-with-visibility'] })
      queryClient.invalidateQueries({ queryKey: ['bundle-visibility-stats'] })
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      toast.success('Hidden files reset successfully')
    },
    onError: (error: Error) => toast.error(`Failed to reset hidden files: ${error.message}`)
  })

  // Filter files
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.path.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesVisibility = filterBy === 'all' ||
      (filterBy === 'hidden' && !file.visible) ||
      (filterBy === 'visible' && file.visible)
    const shouldShow = showHidden || file.visible

    return matchesSearch && matchesVisibility && shouldShow
  })

  // Handlers
  const handleToggleFile = (filePath: string) => {
    toggleFileMutation.mutate({ filePath, bundleName: selectedBundle })
  }

  const handleBulkToggle = (forceHide: boolean) => {
    bulkToggleMutation.mutate({
      filePaths: selectedFiles,
      bundleName: selectedBundle,
      forceHide
    })
  }

  const handleAddPattern = () => {
    if (newPattern.trim()) {
      patternMutation.mutate({ action: 'add', pattern: newPattern.trim() })
      setNewPattern('')
    }
  }

  const handleTogglePattern = (pattern: string, isSystem = false) => {
    const action = isSystem ? 'toggle-system' : 'remove'
    patternMutation.mutate({ action, pattern })
  }

  const allPatterns = [
    ...(ignorePatterns.system || []).map(p => ({ ...p, source: 'system' as const })),
    ...(ignorePatterns.user || []).map(p => ({ ...p, source: 'user' as const })),
    ...(ignorePatterns.file || []).map(p => ({ ...p, source: 'file' as const }))
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-medium">File Visibility & Ignore Management</h2>
          <p className="text-xs text-muted-foreground font-normal">
            Control which files appear in bundles and manage ignore patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {filteredFiles.filter(f => f.visible).length} visible
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <EyeOff className="w-3 h-3" />
            {filteredFiles.filter(f => !f.visible).length} hidden
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="files" className="space-y-6">
        <TabsList>
          <TabsTrigger value="files">File Visibility</TabsTrigger>
          <TabsTrigger value="patterns">Ignore Patterns</TabsTrigger>
          <TabsTrigger value="bundles">Bundle Overview</TabsTrigger>
        </TabsList>

        {/* File Visibility Tab */}
        <TabsContent value="files" className="space-y-4">
          {/* Bundle Selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium">Bundle:</label>
                  <select
                    value={selectedBundle || ''}
                    onChange={(e) => setSelectedBundle(e.target.value || null)}
                    className="px-2 py-1 border rounded-md text-xs"
                  >
                    <option value="">All Bundles (Global)</option>
                    {Object.keys(bundleStats).map(bundleName => (
                      <option key={bundleName} value={bundleName}>{bundleName}</option>
                    ))}
                  </select>
                </div>

                {selectedBundle && (
                  <Badge variant="secondary">
                    Bundle-specific visibility for {selectedBundle}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 text-xs ${showHidden ? 'bg-[color:var(--color-info)]/5 border-[color:var(--color-info)]/20' : ''}`}
                    onClick={() => setShowHidden(!showHidden)}
                  >
                    {showHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {showHidden ? 'Hide Hidden' : 'Show Hidden'}
                  </Button>

                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="px-2 py-1 border rounded-md text-xs"
                  >
                    <option value="all">All Files</option>
                    <option value="visible">Visible Only</option>
                    <option value="hidden">Hidden Only</option>
                  </select>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedFiles.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-[color:var(--color-info)]/5 rounded-md border border-[color:var(--color-info)]/20 mt-4">
                  <Info className="w-4 h-4 text-[color:var(--color-info)]" />
                  <span className="text-xs text-[color:var(--color-info)] font-normal">
                    {selectedFiles.length} files selected
                  </span>
                  <div className="flex gap-2 ml-auto">
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleBulkToggle(false)}>
                      <Eye className="w-3 h-3 mr-1" />
                      Show All
                    </Button>
                    <Button size="sm" className="h-7 text-xs" variant="outline" onClick={() => handleBulkToggle(true)}>
                      <EyeOff className="w-3 h-3 mr-1" />
                      Hide All
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      variant="ghost"
                      onClick={() => setSelectedFiles([])}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File List */}
          <Card>
            <CardContent className="pt-6">
              {filesLoading ? (
                <div className="text-center py-8">Loading files...</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.path}
                      className={`flex items-center gap-3 p-2 rounded-md border transition-colors ${!file.visible ? 'opacity-60 bg-muted/50' : 'hover:bg-muted/50'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.path)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFiles([...selectedFiles, file.path])
                          } else {
                            setSelectedFiles(selectedFiles.filter(f => f !== file.path))
                          }
                        }}
                        className="rounded"
                      />

                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs truncate">{file.path}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {file.inBundles.map(bundle => (
                            <Badge key={bundle} variant="outline" className="text-xs">
                              {bundle}
                            </Badge>
                          ))}
                          {file.globallyHidden && (
                            <Badge variant="destructive" className="text-xs">
                              Globally Hidden
                            </Badge>
                          )}
                          {file.bundleHidden && selectedBundle && (
                            <Badge variant="secondary" className="text-xs">
                              Hidden in {selectedBundle}
                            </Badge>
                          )}
                          {file.matchesIgnorePattern && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Ignored
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)}kb
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleFile(file.path)}
                        disabled={toggleFileMutation.isPending}
                        className="flex-shrink-0"
                      >
                        {file.visible ? (
                          <>
                            <EyeOff className="w-3 h-3 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            Show
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {filteredFiles.length === 0 && !filesLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  No files match your current filters
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reset Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <RotateCcw className="w-4 h-4" />
                Reset Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => resetMutation.mutate({ scope: 'global' })}
                  disabled={resetMutation.isPending}
                >
                  Reset Global Hidden Files
                </Button>

                {selectedBundle && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetMutation.mutate({ scope: 'bundle', bundleName: selectedBundle })}
                    disabled={resetMutation.isPending}
                  >
                    Reset {selectedBundle} Bundle
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetMutation.mutate({ scope: 'all' })}
                  disabled={resetMutation.isPending}
                  className="text-destructive border-destructive/20 hover:bg-destructive/5"
                >
                  Reset All Hidden Files
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ignore Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          {/* Add New Pattern */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Add Ignore Pattern</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter glob pattern (e.g., *.log, src/debug/**)"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
                />
                <Button
                  onClick={handleAddPattern}
                  disabled={!newPattern.trim() || patternMutation.isPending}
                  size="sm"
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Pattern
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Examples: <code>*.log</code>, <code>node_modules/**</code>, <code>src/debug.ts</code>, <code>**/*.test.*</code>
              </div>
            </CardContent>
          </Card>

          {/* Existing Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Current Ignore Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              {patternsLoading ? (
                <div className="text-center py-4">Loading patterns...</div>
              ) : (
                <div className="space-y-3">
                  {allPatterns.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-md border ${!item.active ? 'opacity-60 bg-muted/50' : ''
                        }`}
                    >
                      <div className="flex-1">
                        <div className="font-mono text-xs">{item.pattern}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={item.source === 'system' ? 'secondary' :
                              item.source === 'user' ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {item.source === 'system' ? 'System Default' :
                              item.source === 'user' ? 'User Added' : 'File Pattern'}
                          </Badge>
                          {item.active ? (
                            <Badge variant="outline" className="text-xs text-[color:var(--color-success)]">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {item.source === 'system' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTogglePattern(item.pattern, true)}
                            disabled={patternMutation.isPending}
                          >
                            {item.active ? 'Disable' : 'Enable'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTogglePattern(item.pattern, false)}
                            disabled={patternMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bundle Overview Tab */}
        <TabsContent value="bundles" className="space-y-4">
          {statsLoading ? (
            <div className="text-center py-8">Loading bundle statistics...</div>
          ) : (
            <div className="grid gap-4">
              {Object.entries(bundleStats).map(([bundleName, stats]) => (
                <Card key={bundleName}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-medium">{bundleName}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {stats.visible} / {stats.total} visible
                        </Badge>
                        {stats.hidden > 0 && (
                          <Badge variant="secondary">
                            {stats.hidden} hidden
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-border rounded-full h-2">
                          <div
                            className="bg-[color:var(--color-info)] h-2 rounded-full"
                            style={{
                              width: `${stats.total > 0 ? (stats.visible / stats.total) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setSelectedBundle(bundleName)}
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Manage Files
                        </Button>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <div>Patterns: {stats.patterns.join(', ')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
