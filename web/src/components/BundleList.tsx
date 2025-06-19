// web/src/components/BundleList.tsx
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, RefreshCw, ChevronDown, ChevronRight, Loader2, CheckCircle, AlertCircle, Download, Folder, FileText, Settings, Code, Hash, TestTube, BookOpen, Edit3, X, Plus, Minus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface Bundle {
  name: string
  changed: boolean
  fileCount: number
  content: string
  files: string[]
  lastGenerated: string
  size: number
}

interface BundleCategories {
  purpose: string
  filesByType: Record<string, string[]>
  entryPoints: string[]
  totalFiles: number
}

const fetchBundles = async (): Promise<Bundle[]> => {
  const response = await fetch('http://localhost:3333/api/bundles')
  if (!response.ok) throw new Error('Failed to fetch bundles')
  return response.json()
}

const fetchBundleCategories = async (bundleName: string): Promise<BundleCategories> => {
  const response = await fetch(`http://localhost:3333/api/bundle-categories/${bundleName}`)
  if (!response.ok) throw new Error('Failed to fetch bundle categories')
  return response.json()
}

const fetchAllFiles = async (): Promise<string[]> => {
  const response = await fetch('http://localhost:3333/api/files')
  if (!response.ok) throw new Error('Failed to fetch files')
  const fileData = await response.json()
  return fileData.map((f: any) => f.path)
}

export function BundleList() {
  const queryClient = useQueryClient()
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set())
  const [bundleCategories, setBundleCategories] = useState<Record<string, BundleCategories>>({})
  const [editingBundles, setEditingBundles] = useState<Set<string>>(new Set())
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [loadingButtons, setLoadingButtons] = useState<Set<string>>(new Set())
  const [successButtons, setSuccessButtons] = useState<Set<string>>(new Set())
  const [errorButtons, setErrorButtons] = useState<Set<string>>(new Set())

  // Manual fetch function
  const refetch = async () => {
    console.log('Manual refetch called')
    try {
      const freshBundles = await fetchBundles()
      console.log('Fresh bundles received:', freshBundles)
      setBundles(freshBundles)
      return { data: freshBundles }
    } catch (error) {
      console.error('Failed to fetch bundles:', error)
      return { data: [] }
    }
  }

  // Initial load and periodic refresh
  useState(() => {
    refetch().then(() => setIsLoading(false))
    const interval = setInterval(refetch, 5000)
    return () => clearInterval(interval)
  })

  const toggleExpanded = async (bundleName: string) => {
    const newExpanded = new Set(expandedBundles)
    if (newExpanded.has(bundleName)) {
      newExpanded.delete(bundleName)
    } else {
      newExpanded.add(bundleName)
      // Fetch categories if we don't have them yet
      if (!bundleCategories[bundleName]) {
        try {
          const categories = await fetchBundleCategories(bundleName)
          setBundleCategories(prev => ({
            ...prev,
            [bundleName]: categories
          }))
        } catch (error) {
          console.error('Failed to fetch bundle categories:', error)
          toast.error('Failed to load file categories')
        }
      }
    }
    setExpandedBundles(newExpanded)
  }

  // Helper function to get icon for file type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'components': return <Code className="w-4 h-4" />
      case 'hooks': return <Hash className="w-4 h-4" />
      case 'utilities': return <Settings className="w-4 h-4" />
      case 'configuration': return <Settings className="w-4 h-4" />
      case 'styles': return <Folder className="w-4 h-4" />
      case 'types': return <FileText className="w-4 h-4" />
      case 'tests': return <TestTube className="w-4 h-4" />
      case 'documentation': return <BookOpen className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  // Helper function to get color for file type
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'components': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'hooks': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'utilities': return 'bg-green-100 text-green-800 border-green-200'
      case 'configuration': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'styles': return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'types': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'tests': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'documentation': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // File picker functions
  const toggleEditMode = async (bundleName: string) => {
    const newEditing = new Set(editingBundles)
    if (newEditing.has(bundleName)) {
      newEditing.delete(bundleName)
    } else {
      newEditing.add(bundleName)
      // Fetch all available files when entering edit mode
      if (availableFiles.length === 0) {
        try {
          const files = await fetchAllFiles()
          setAvailableFiles(files)
        } catch (error) {
          console.error('Failed to fetch files:', error)
          toast.error('Failed to load file list')
        }
      }
    }
    setEditingBundles(newEditing)
  }

  const isFileInBundle = (fileName: string, bundle: Bundle) => {
    return bundle.files.includes(fileName)
  }

  const getFileExclusions = (fileName: string, currentBundle: string): string[] => {
    if (!bundles || !Array.isArray(bundles)) return []
    return bundles
      .filter((b: Bundle) => b.name !== currentBundle && b.files.includes(fileName))
      .map((b: Bundle) => b.name)
  }

  const removeFileFromBundle = async (fileName: string, bundleName: string) => {
    try {
      setButtonState(`remove-${bundleName}-${fileName}`, 'loading')
      
      console.log(`Removing ${fileName} from ${bundleName}`)
      
      // Prevent modifications to master bundle
      if (bundleName === 'master') {
        setButtonState(`remove-${bundleName}-${fileName}`, 'error')
        toast.error('Cannot modify master bundle files')
        return
      }
      
      const response = await fetch('http://localhost:3333/api/hidden-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          filePath: fileName,
          bundleName: bundleName,
          forceHide: true // Force hide the file (remove from bundle)
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        throw new Error(`Failed to remove file: ${errorText}`)
      }

      const result = await response.json()
      console.log('Remove API Response:', result)

      // Invalidate all related queries to force refresh
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      queryClient.invalidateQueries({ queryKey: ['hidden-files'] })
      
      // Force immediate refetch and UI update
      await refetch()
      setButtonState(`remove-${bundleName}-${fileName}`, 'success')
      toast.success(`Hidden ${fileName} from ${bundleName} bundle`)
      
    } catch (error) {
      console.error('Failed to remove file:', error)
      setButtonState(`remove-${bundleName}-${fileName}`, 'error')
      toast.error(`Failed to remove file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const addFileToBundle = async (fileName: string, bundleName: string) => {
    try {
      setButtonState(`add-${bundleName}-${fileName}`, 'loading')
      
      console.log(`Adding ${fileName} to ${bundleName}`)
      
      // Prevent modifications to master bundle
      if (bundleName === 'master') {
        setButtonState(`add-${bundleName}-${fileName}`, 'error')
        toast.error('Cannot modify master bundle files')
        return
      }
      
      const response = await fetch('http://localhost:3333/api/hidden-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          filePath: fileName,
          bundleName: bundleName,
          forceHide: false // Force show the file (add to bundle)
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        throw new Error(`Failed to add file: ${errorText}`)
      }

      const result = await response.json()
      console.log('Add API Response:', result)

      // Force invalidate the cache and refetch immediately
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      await refetch()
      setButtonState(`add-${bundleName}-${fileName}`, 'success')
      toast.success(`Added ${fileName}`)
      
    } catch (error) {
      console.error('Failed to add file:', error)
      setButtonState(`add-${bundleName}-${fileName}`, 'error')
      toast.error(`Failed to add file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const setButtonState = (key: string, state: 'loading' | 'success' | 'error' | 'idle') => {
    setLoadingButtons(prev => {
      const newSet = new Set(prev)
      if (state === 'loading') newSet.add(key)
      else newSet.delete(key)
      return newSet
    })

    setSuccessButtons(prev => {
      const newSet = new Set(prev)
      if (state === 'success') {
        newSet.add(key)
        // Auto-clear success state after 2 seconds
        setTimeout(() => setSuccessButtons(current => {
          const updated = new Set(current)
          updated.delete(key)
          return updated
        }), 2000)
      } else {
        newSet.delete(key)
      }
      return newSet
    })

    setErrorButtons(prev => {
      const newSet = new Set(prev)
      if (state === 'error') {
        newSet.add(key)
        // Auto-clear error state after 3 seconds
        setTimeout(() => setErrorButtons(current => {
          const updated = new Set(current)
          updated.delete(key)
          return updated
        }), 3000)
      } else {
        newSet.delete(key)
      }
      return newSet
    })
  }

  const copyBundle = async (bundleName: string) => {
    const key = `copy-${bundleName}`
    setButtonState(key, 'loading')

    try {
      const response = await fetch(`http://localhost:3333/api/bundles/${bundleName}`)
      if (!response.ok) throw new Error('Failed to fetch bundle content')

      const content = await response.text()
      await navigator.clipboard.writeText(content)

      setButtonState(key, 'success')
      toast.success(`Bundle "${bundleName}" copied to clipboard!`)
    } catch (error) {
      setButtonState(key, 'error')
      toast.error(`Failed to copy bundle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const downloadBundle = async (bundleName: string) => {
    const key = `download-${bundleName}`
    setButtonState(key, 'loading')

    try {
      const response = await fetch(`http://localhost:3333/api/bundles/${bundleName}`)
      if (!response.ok) throw new Error('Failed to fetch bundle content')

      const content = await response.text()
      const blob = new Blob([content], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${bundleName}-bundle.xml`
      a.click()
      URL.revokeObjectURL(url)

      setButtonState(key, 'success')
      toast.success(`Bundle "${bundleName}" downloaded!`)
    } catch (error) {
      setButtonState(key, 'error')
      toast.error(`Failed to download bundle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const regenerateBundle = async (bundleName: string) => {
    const key = `regen-${bundleName}`
    setButtonState(key, 'loading')

    try {
      const response = await fetch(`http://localhost:3333/api/regenerate/${bundleName}`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to regenerate bundle')

      await refetch()
      setButtonState(key, 'success')
      toast.success(`Bundle "${bundleName}" regenerated successfully!`)
    } catch (error) {
      setButtonState(key, 'error')
      toast.error(`Failed to regenerate bundle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (isLoading) return <div>Loading bundles...</div>
  if (!bundles) return <div>No bundles found</div>

  const manualRefresh = async () => {
    console.log('Manual refresh triggered')
    queryClient.removeQueries({ queryKey: ['bundles'] })
    const result = await refetch()
    console.log('Fresh bundles data:', result.data)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Bundles</h2>
        <Button onClick={manualRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" />
          Force Refresh
        </Button>
      </div>
      {bundles && Array.isArray(bundles) ? bundles.map((bundle) => {
        const copyKey = `copy-${bundle.name}`
        const downloadKey = `download-${bundle.name}`
        const regenKey = `regen-${bundle.name}`
        const isCopyLoading = loadingButtons.has(copyKey)
        const isDownloadLoading = loadingButtons.has(downloadKey)
        const isRegenLoading = loadingButtons.has(regenKey)
        const isCopySuccess = successButtons.has(copyKey)
        const isDownloadSuccess = successButtons.has(downloadKey)
        const isRegenSuccess = successButtons.has(regenKey)
        const isCopyError = errorButtons.has(copyKey)
        const isDownloadError = errorButtons.has(downloadKey)
        const isRegenError = errorButtons.has(regenKey)

        return (
          <Card key={bundle.name} className={bundle.changed ? 'border-yellow-500' : ''}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  {bundle.name}
                  <Badge variant={bundle.changed ? 'destructive' : 'secondary'}>
                    {bundle.changed ? 'CHANGED' : 'SYNCED'}
                  </Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleEditMode(bundle.name)}
                    disabled={bundle.name === 'master'}
                    className={editingBundles.has(bundle.name) ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                  >
                    {editingBundles.has(bundle.name) ? (
                      <X className="w-4 h-4 mr-1" />
                    ) : (
                      <Edit3 className="w-4 h-4 mr-1" />
                    )}
                    {bundle.name === 'master' ? 'Read Only' : editingBundles.has(bundle.name) ? 'Cancel' : 'Edit Files'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateBundle(bundle.name)}
                    disabled={isRegenLoading}
                    className={`transition-all duration-200 ${isRegenSuccess ? 'border-green-500 bg-green-50 text-green-700' :
                      isRegenError ? 'border-red-500 bg-red-50 text-red-700' :
                        isRegenLoading ? 'opacity-75' : ''
                      }`}
                  >
                    {isRegenLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : isRegenSuccess ? (
                      <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                    ) : isRegenError ? (
                      <AlertCircle className="w-4 h-4 mr-1 text-red-600" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyBundle(bundle.name)}
                    disabled={isCopyLoading}
                    className={`transition-all duration-200 ${isCopySuccess ? 'border-green-500 bg-green-50 text-green-700' :
                      isCopyError ? 'border-red-500 bg-red-50 text-red-700' :
                        isCopyLoading ? 'opacity-75' : ''
                      }`}
                  >
                    {isCopyLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : isCopySuccess ? (
                      <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                    ) : isCopyError ? (
                      <AlertCircle className="w-4 h-4 mr-1 text-red-600" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1" />
                    )}
                    Copy XML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadBundle(bundle.name)}
                    disabled={isDownloadLoading}
                    className={`transition-all duration-200 ${isDownloadSuccess ? 'border-green-500 bg-green-50 text-green-700' :
                      isDownloadError ? 'border-red-500 bg-red-50 text-red-700' :
                        isDownloadLoading ? 'opacity-75' : ''
                      }`}
                  >
                    {isDownloadLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : isDownloadSuccess ? (
                      <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                    ) : isDownloadError ? (
                      <AlertCircle className="w-4 h-4 mr-1 text-red-600" />
                    ) : (
                      <Download className="w-4 h-4 mr-1" />
                    )}
                    Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-3">
                {bundle.fileCount} files • {(bundle.size / 1024).toFixed(1)}kb
                {bundle.lastGenerated &&
                  ` • Generated ${new Date(bundle.lastGenerated).toLocaleTimeString()}`
                }
              </div>

              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded(bundle.name)}
                  className="p-0 h-auto font-normal"
                >
                  {expandedBundles.has(bundle.name) ? (
                    <ChevronDown className="w-4 h-4 mr-1" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-1" />
                  )}
                  View Files ({bundle.files.length})
                </Button>

                {expandedBundles.has(bundle.name) && (
                  <div className="ml-5 space-y-3">
                    {bundleCategories[bundle.name] ? (
                      <>
                        {/* Bundle Purpose */}
                        <div className="text-sm text-muted-foreground italic">
                          {bundleCategories[bundle.name].purpose}
                        </div>

                        {/* Entry Points */}
                        {bundleCategories[bundle.name].entryPoints.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <FileText className="w-3 h-3 mr-1" />
                                Entry Points
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ({bundleCategories[bundle.name].entryPoints.length})
                              </span>
                            </div>
                            <div className="pl-4 space-y-1">
                              {bundleCategories[bundle.name].entryPoints.map((file) => (
                                <div key={file} className="text-sm font-mono text-muted-foreground">
                                  {file}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* File Categories */}
                        {Object.entries(bundleCategories[bundle.name].filesByType).map(([type, files]) => (
                          <div key={type} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={getTypeColor(type)}>
                                {getTypeIcon(type)}
                                <span className="ml-1 capitalize">{type}</span>
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ({files.length} files)
                              </span>
                            </div>
                            <div className="pl-4 space-y-1 max-h-32 overflow-y-auto">
                              {editingBundles.has(bundle.name) ? (
                                // Edit mode: show files with remove buttons
                                files.map((file) => {
                                  const exclusions = getFileExclusions(file, bundle.name)
                                  const removeKey = `remove-${bundle.name}-${file}`
                                  const isLoading = loadingButtons.has(removeKey)
                                  return (
                                    <div key={file} className="flex items-center gap-2 text-sm">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeFileFromBundle(file, bundle.name)}
                                        disabled={isLoading}
                                        className="h-6 w-6 p-0 border-red-200 hover:bg-red-50 hover:border-red-300"
                                      >
                                        {isLoading ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Minus className="w-3 h-3 text-red-600" />
                                        )}
                                      </Button>
                                      <span className="font-mono flex-1 text-foreground">
                                        {file}
                                      </span>
                                      {exclusions.length > 0 && (
                                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                                          Also in: {exclusions.join(', ')}
                                        </Badge>
                                      )}
                                    </div>
                                  )
                                })
                              ) : (
                                // View mode: show files normally
                                files.map((file) => (
                                  <div key={file} className="text-sm font-mono text-muted-foreground">
                                    {file}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Available Files Section (Edit Mode Only) */}
                        {editingBundles.has(bundle.name) && (
                          <div className="space-y-2 mt-6 pt-4 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                                <Plus className="w-3 h-3 mr-1" />
                                Available Files
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                (Click + to add to bundle)
                              </span>
                            </div>
                            <div className="pl-4 space-y-1 max-h-40 overflow-y-auto">
                              {availableFiles
                                .filter(file => !isFileInBundle(file, bundle))
                                .map((file) => {
                                  const exclusions = getFileExclusions(file, bundle.name)
                                  const addKey = `add-${bundle.name}-${file}`
                                  const isLoading = loadingButtons.has(addKey)
                                  return (
                                    <div key={file} className="flex items-center gap-2 text-sm">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addFileToBundle(file, bundle.name)}
                                        disabled={isLoading}
                                        className="h-6 w-6 p-0 border-green-200 hover:bg-green-50 hover:border-green-300"
                                      >
                                        {isLoading ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Plus className="w-3 h-3 text-green-600" />
                                        )}
                                      </Button>
                                      <span className="font-mono flex-1 text-muted-foreground">
                                        {file}
                                      </span>
                                      {exclusions.length > 0 && (
                                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                                          In: {exclusions.join(', ')}
                                        </Badge>
                                      )}
                                    </div>
                                  )
                                })
                              }
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // Fallback to simple list while loading
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {bundle.files.map((file: string) => (
                          <div key={file} className="text-sm font-mono text-muted-foreground">
                            {file}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      }) : <div>No bundles available</div>}
    </div>
  )
}
