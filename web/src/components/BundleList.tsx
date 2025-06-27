// web/src/components/BundleList.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Copy, RefreshCw, Loader2, CheckCircle, AlertCircle, Download, FileText, Settings, Code, BookOpen, Edit3, X, Plus, Minus, Search, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/lib/toast'

interface Bundle {
  name: string
  changed: boolean
  fileCount: number
  content: string
  files: string[]
  lastGenerated: string
  size: number
}


const fetchBundles = async (): Promise<Bundle[]> => {
  const response = await fetch('http://localhost:3333/api/bundles')
  if (!response.ok) throw new Error('Failed to fetch bundles')
  return response.json()
}


const fetchAllFiles = async (): Promise<string[]> => {
  const response = await fetch('http://localhost:3333/api/files')
  if (!response.ok) throw new Error('Failed to fetch files')
  const fileData = await response.json()
  return fileData.map((f: any) => f.path)
}

const fetchUndercategorizedFiles = async (): Promise<{path: string, bundles: string[]}[]> => {
  const response = await fetch('http://localhost:3333/api/files-with-visibility')
  if (!response.ok) throw new Error('Failed to fetch files with visibility')
  const filesData = await response.json()
  
  // Find files that are only in the 'master' bundle (need better bundle assignment)
  // AND aren't globally hidden (which means they should be ignored)
  return filesData
    .filter((file: any) => {
      const isNotGloballyHidden = !file.globallyHidden
      const bundles = file.inBundles || []
      const onlyInMaster = bundles.length === 1 && bundles[0] === 'master'
      const hasNoBundles = bundles.length === 0
      
      return isNotGloballyHidden && (onlyInMaster || hasNoBundles)
    })
    .map((file: any) => ({
      path: file.path,
      bundles: file.inBundles || []
    }))
}

const suggestBundleForFile = (filePath: string): string[] => {
  const fileName = filePath.toLowerCase()
  const pathParts = fileName.split('/')
  
  const suggestions: string[] = []
  
  // Web/frontend files
  if (pathParts.includes('web') || pathParts.includes('src')) {
    suggestions.push('frontend')
    
    // More specific frontend bundles
    if (pathParts.includes('components')) {
      suggestions.push('ui-components')
    }
  }
  
  // Server/backend files
  if (fileName.includes('server') || fileName.includes('api') || pathParts.includes('bin')) {
    suggestions.push('server')
  }
  
  // Configuration files
  if (fileName.includes('config') || fileName.includes('setup') || fileName.endsWith('.json') || 
      fileName.endsWith('.sh') || fileName.includes('package')) {
    suggestions.push('config')
  }
  
  // Documentation
  if (fileName.endsWith('.md') || fileName.includes('doc') || fileName.includes('readme')) {
    suggestions.push('docs')
  }
  
  // If no specific suggestions, suggest the most general applicable bundles
  if (suggestions.length === 0) {
    if (pathParts.includes('web')) {
      suggestions.push('frontend')
    } else {
      suggestions.push('server', 'config')
    }
  }
  
  return suggestions
}

export function BundleList() {
  const queryClient = useQueryClient()
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null)
  const [editingBundles, setEditingBundles] = useState<Set<string>>(new Set())
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [undercategorizedFiles, setUndercategorizedFiles] = useState<{path: string, bundles: string[]}[]>([])
  const [showFileAnalysis, setShowFileAnalysis] = useState(false)
  const [availableFilesSearch, setAvailableFilesSearch] = useState('')
  const [loadingButtons, setLoadingButtons] = useState<Set<string>>(new Set())
  const [successButtons, setSuccessButtons] = useState<Set<string>>(new Set())
  const [errorButtons, setErrorButtons] = useState<Set<string>>(new Set())

  // Use React Query for proper state management
  const { data: bundles = [], isLoading, refetch } = useQuery({
    queryKey: ['bundles'],
    queryFn: fetchBundles,
    refetchInterval: 5000,
    refetchOnWindowFocus: true
  })

  const selectBundle = async (bundleName: string) => {
    if (selectedBundle === bundleName) {
      setSelectedBundle(null)
    } else {
      setSelectedBundle(bundleName)
    }
  }

  // Get which bundles a file belongs to
  const getFileBundles = (filePath: string) => {
    return bundles.filter(bundle => bundle.files.includes(filePath)).map(b => b.name)
  }

  // Helper function to get icon for file type
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return <Code className="w-3 h-3 text-blue-500" />
      case 'ts':
      case 'js':
        return <FileText className="w-3 h-3 text-yellow-500" />
      case 'json':
        return <Settings className="w-3 h-3 text-green-500" />
      case 'md':
        return <BookOpen className="w-3 h-3 text-purple-500" />
      case 'css':
      case 'scss':
        return <FileText className="w-3 h-3 text-pink-500" />
      case 'html':
        return <FileText className="w-3 h-3 text-orange-500" />
      case 'sh':
        return <FileText className="w-3 h-3 text-gray-500" />
      default:
        return <FileText className="w-3 h-3 text-gray-400" />
    }
  }


  // File picker functions
  const toggleEditMode = async (bundleName: string) => {
    const newEditing = new Set(editingBundles)
    if (newEditing.has(bundleName)) {
      newEditing.delete(bundleName)
    } else {
      newEditing.add(bundleName)
      // Always fetch fresh available files when entering edit mode
      try {
        const files = await fetchAllFiles()
        setAvailableFiles(files)
      } catch (error) {
        console.error('Failed to fetch files:', error)
        toast.error('Failed to load file list')
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

      // Get current configuration
      const configResponse = await fetch('http://localhost:3333/api/config')
      if (!configResponse.ok) {
        throw new Error('Failed to fetch current configuration')
      }
      
      const currentConfig = await configResponse.json()
      
      // Remove the file from the bundle's patterns (not hide it!)
      if (currentConfig.bundles[bundleName]) {
        currentConfig.bundles[bundleName] = currentConfig.bundles[bundleName].filter(
          (pattern: string) => pattern !== fileName
        )
        console.log(`Removed ${fileName} from ${bundleName} patterns`)
      }

      // Update the configuration
      const updateResponse = await fetch('http://localhost:3333/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
      })

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        console.error('API Error:', errorText)
        throw new Error(`Failed to update configuration: ${errorText}`)
      }

      // Force refresh the bundles query to get the updated data
      queryClient.invalidateQueries({ queryKey: ['bundles'] })

      setButtonState(`remove-${bundleName}-${fileName}`, 'success')
      toast.success(`Removed ${fileName} from ${bundleName} bundle`)

    } catch (error) {
      console.error('Failed to remove file:', error)
      setButtonState(`remove-${bundleName}-${fileName}`, 'error')
      toast.error(`Failed to remove file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const addFileToBundle = async (fileName: string, bundleName: string) => {
    try {
      setButtonState(`add-${bundleName}-${fileName}`, 'loading')

      // Prevent modifications to master bundle
      if (bundleName === 'master') {
        setButtonState(`add-${bundleName}-${fileName}`, 'error')
        toast.error('Cannot modify master bundle files')
        return
      }

      // First, get the current configuration
      const configResponse = await fetch('http://localhost:3333/api/config')
      if (!configResponse.ok) {
        throw new Error('Failed to fetch current configuration')
      }
      
      const currentConfig = await configResponse.json()
      
      // Add the file to the bundle's patterns
      if (!currentConfig.bundles[bundleName]) {
        currentConfig.bundles[bundleName] = []
      }
      
      // Add the exact file path if it's not already there
      if (!currentConfig.bundles[bundleName].includes(fileName)) {
        currentConfig.bundles[bundleName].push(fileName)
      }

      // Update the configuration
      const updateResponse = await fetch('http://localhost:3333/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
      })

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        throw new Error(`Failed to update configuration: ${errorText}`)
      }

      // Remove the file from the bundle's hidden list
      await fetch('http://localhost:3333/api/hidden-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          filePath: fileName,
          bundleName: bundleName,
          forceHide: false
        })
      })

      // Force refresh the bundles query to get the updated data
      queryClient.invalidateQueries({ queryKey: ['bundles'] })

      setButtonState(`add-${bundleName}-${fileName}`, 'success')
      toast.success(`Added ${fileName} to ${bundleName} bundle`)

      // Refresh undercategorized files if they're currently being shown
      if (showFileAnalysis) {
        await loadFileAnalysis()
      }

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

  const loadFileAnalysis = async () => {
    try {
      const undercategorized = await fetchUndercategorizedFiles()
      setUndercategorizedFiles(undercategorized)
      
      console.log('Found undercategorized files:', { 
        total: undercategorized.length,
        files: undercategorized.map(f => ({ path: f.path, bundles: f.bundles }))
      })
    } catch (error) {
      console.error('Failed to fetch file analysis:', error)
      toast.error('Failed to load file analysis')
    }
  }

  const suggestCategoryImprovement = async (filePath: string, suggestedCategory: string) => {
    const key = `categorize-${filePath}`
    setButtonState(key, 'loading')
    
    try {
      // For now, we'll just show a success message and suggest the user report this to improve the backend
      // In a real implementation, this would send category suggestions to the backend for ML training
      toast.success(`Category suggestion recorded: ${filePath} → ${suggestedCategory}`)
      
      // TODO: Implement actual backend endpoint for category suggestions
      // const response = await fetch('http://localhost:3333/api/suggest-category', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ filePath, suggestedCategory })
      // })
      
      setButtonState(key, 'success')
    } catch (error) {
      console.error('Failed to suggest category:', error)
      setButtonState(key, 'error')
      toast.error('Failed to record category suggestion')
    }
  }

  const manualRefresh = async () => {
    console.log('Manual refresh triggered')
    queryClient.removeQueries({ queryKey: ['bundles'] })
    const result = await refetch()
    console.log('Fresh bundles data:', result.data)
    
    // Also refresh file analysis
    if (showFileAnalysis) {
      await loadFileAnalysis()
    }
  }

  // Bundle Grid Card Component
  const BundleGridCard = ({ bundle }: { bundle: Bundle }) => {
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
    const isSelected = selectedBundle === bundle.name
    
    // Check if bundle has files needing bundle assignment (files only in master bundle)
    const fileBundles = bundle.files.map(file => getFileBundles(file))
    const hasUnassignedFiles = fileBundles.some(bundles => bundles.length === 1 && bundles[0] === 'master')

    return (
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md ${
          bundle.changed ? 'border-warning' : ''
        } ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
        onClick={() => selectBundle(bundle.name)}
      >
        <CardHeader className="pb-2">
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium truncate">{bundle.name}</h3>
            <Badge variant={bundle.changed ? 'destructive' : 'secondary'} className="text-xs font-normal h-4 w-fit">
              {bundle.changed ? 'CHANGED' : 'SYNCED'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                <span>{bundle.fileCount} files</span>
                <span>•</span>
                <span>{(bundle.size / 1024).toFixed(1)}kb</span>
                {hasUnassignedFiles && (
                  <>
                    <span>•</span>
                    <span className="text-warning text-xs">
                      <AlertTriangle className="w-2.5 h-2.5 inline mr-1" />
                      Files need assignment
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex" onClick={(e) => e.stopPropagation()}>
              <div className="inline-flex rounded-md border border-input bg-background shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => regenerateBundle(bundle.name)}
                  disabled={isRegenLoading}
                  className="h-6 px-1.5 rounded-none border-r border-input first:rounded-l-md last:rounded-r-md hover:bg-accent"
                >
                  {isRegenLoading ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : isRegenSuccess ? (
                    <CheckCircle className="w-2.5 h-2.5" />
                  ) : isRegenError ? (
                    <AlertCircle className="w-2.5 h-2.5" />
                  ) : (
                    <RefreshCw className="w-2.5 h-2.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyBundle(bundle.name)}
                  disabled={isCopyLoading}
                  className="h-6 px-1.5 rounded-none border-r border-input first:rounded-l-md last:rounded-r-md hover:bg-accent"
                >
                  {isCopyLoading ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : isCopySuccess ? (
                    <CheckCircle className="w-2.5 h-2.5" />
                  ) : isCopyError ? (
                    <AlertCircle className="w-2.5 h-2.5" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadBundle(bundle.name)}
                  disabled={isDownloadLoading}
                  className="h-6 px-1.5 rounded-none first:rounded-l-md last:rounded-r-md hover:bg-accent"
                >
                  {isDownloadLoading ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : isDownloadSuccess ? (
                    <CheckCircle className="w-2.5 h-2.5" />
                  ) : isDownloadError ? (
                    <AlertCircle className="w-2.5 h-2.5" />
                  ) : (
                    <Download className="w-2.5 h-2.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Bundles</h2>
          {undercategorizedFiles.length > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {undercategorizedFiles.length} files need better bundle assignment
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              if (!showFileAnalysis) {
                await loadFileAnalysis()
              }
              setShowFileAnalysis(!showFileAnalysis)
            }}
            variant={showFileAnalysis ? "default" : "outline"}
            size="sm"
          >
            <Search className="w-4 h-4 mr-1" />
            {showFileAnalysis ? 'Hide' : 'Analyze'} File Bundle Assignment
          </Button>
          <Button onClick={manualRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Force Refresh
          </Button>
        </div>
      </div>
      
      {/* File Bundle Assignment Analysis Section */}
      {showFileAnalysis && (
        <Card className="border-warning/20 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4" />
              File Bundle Assignment Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Files that need better bundle assignment. All files belong to the 'master' bundle by default, but should also belong to more specific bundles.
            </p>
          </CardHeader>
          <CardContent>
            {undercategorizedFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[color:var(--color-success)]" />
                <p>Excellent! All files are properly assigned to specific bundles.</p>
                <p className="text-sm">No files are sitting in only the master bundle.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-warning flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Files Needing Bundle Assignment ({undercategorizedFiles.length})
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    These files are only in the 'master' bundle and should be assigned to more specific bundles for better organization.
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {undercategorizedFiles.map((fileInfo) => {
                      const suggestions = suggestBundleForFile(fileInfo.path)
                      const currentBundleText = fileInfo.bundles.length === 0 ? 'none' : fileInfo.bundles.join(', ')
                      
                      return (
                        <div key={fileInfo.path} className="flex items-center gap-2 p-3 rounded border border-warning/20 bg-background">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm text-foreground truncate">
                              {fileInfo.path}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                Currently in: {currentBundleText === 'master' ? 'master only' : currentBundleText}
                              </span>
                              {suggestions.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">Suggested:</span>
                                  {suggestions.slice(0, 2).map((bundle) => (
                                    <Badge key={bundle} variant="outline" className="text-xs px-1 py-0">
                                      {bundle}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Hide this file globally (add to ignore patterns)
                                fetch('http://localhost:3333/api/hidden-files', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    action: 'toggle',
                                    filePath: fileInfo.path,
                                    forceHide: true
                                  })
                                }).then(() => {
                                  toast.success(`Hidden ${fileInfo.path} from all bundles`)
                                  loadFileAnalysis() // Refresh the analysis
                                }).catch(error => {
                                  console.error('Failed to hide file:', error)
                                  toast.error('Failed to hide file')
                                })
                              }}
                              className="h-6 px-2 text-xs border-muted hover:bg-muted"
                            >
                              Ignore
                            </Button>
                            {(suggestions.length > 0 ? suggestions.slice(0, 2) : bundles.filter(b => b.name !== 'master').slice(0, 2)).map((bundleName) => (
                              <Button
                                key={bundleName}
                                variant="outline"
                                size="sm"
                                onClick={() => addFileToBundle(fileInfo.path, bundleName)}
                                className="h-6 px-2 text-xs"
                              >
                                Add to {bundleName}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-warning/20">
                  <span className="text-sm text-muted-foreground">
                    {undercategorizedFiles.length} files need better bundle assignment
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadFileAnalysis}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh Analysis
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Responsive Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Bundle Grid */}
        <div className={`${selectedBundle ? 'hidden lg:block lg:w-1/2' : 'w-full'} transition-all`}>
          <div className={`grid grid-cols-1 gap-4 ${
            selectedBundle 
              ? 'md:grid-cols-2' 
              : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}>
            {bundles && Array.isArray(bundles) ? bundles.map((bundle) => (
              <BundleGridCard key={bundle.name} bundle={bundle} />
            )) : <div>No bundles available</div>}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedBundle && (
          <div className={`${selectedBundle ? 'block' : 'hidden'} ${
            selectedBundle ? 'fixed inset-0 z-50 bg-background lg:relative lg:inset-auto lg:z-auto lg:w-1/2' : ''
          } transition-all flex flex-col`}>
            {/* Mobile Close Button */}
            <div className="lg:hidden sticky top-0 bg-background border-b p-4 flex justify-between items-center flex-shrink-0">
              <h3 className="font-semibold">Bundle Details</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedBundle(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 lg:p-0">
              {(() => {
                const bundle = bundles?.find((b: Bundle) => b.name === selectedBundle)
                if (!bundle) return <div>Bundle not found</div>

                return (
                  <BundleDetailView 
                    bundle={bundle}
                    bundles={bundles}
                    selectedBundleName={selectedBundle}
                    editingBundles={editingBundles}
                    availableFiles={availableFiles}
                    loadingButtons={loadingButtons}
                    successButtons={successButtons}
                    errorButtons={errorButtons}
                    toggleEditMode={toggleEditMode}
                    removeFileFromBundle={removeFileFromBundle}
                    addFileToBundle={addFileToBundle}
                    getFileBundles={getFileBundles}
                    getFileIcon={getFileIcon}
                    availableFilesSearch={availableFilesSearch}
                    setAvailableFilesSearch={setAvailableFilesSearch}
                  />
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Bundle Detail View Component
const BundleDetailView = ({ 
  bundle, 
  bundles,
  selectedBundleName,
  editingBundles, 
  availableFiles, 
  loadingButtons, 
  successButtons, 
  errorButtons,
  toggleEditMode,
  removeFileFromBundle,
  addFileToBundle,
  getFileBundles,
  getFileIcon,
  availableFilesSearch,
  setAvailableFilesSearch
}: {
  bundle: Bundle
  bundles: Bundle[]
  selectedBundleName: string
  editingBundles: Set<string>
  availableFiles: string[]
  loadingButtons: Set<string>
  successButtons: Set<string>
  errorButtons: Set<string>
  toggleEditMode: (bundleName: string) => void
  removeFileFromBundle: (fileName: string, bundleName: string) => void
  addFileToBundle: (fileName: string, bundleName: string) => void
  getFileBundles: (filePath: string) => string[]
  getFileIcon: (fileName: string) => React.ReactNode
  availableFilesSearch: string
  setAvailableFilesSearch: (value: string) => void
}) => {
  // Get the most current bundle from bundles array to ensure we have latest file updates
  const currentBundle = bundles?.find((b: Bundle) => b.name === selectedBundleName) || bundle
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-medium truncate">{bundle.name}</h3>
            <Badge variant={bundle.changed ? 'destructive' : 'secondary'} className="text-xs font-normal">
              {bundle.changed ? 'CHANGED' : 'SYNCED'}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleEditMode(bundle.name)}
              disabled={bundle.name === 'master'}
              className={`h-7 text-xs ${editingBundles.has(bundle.name) ? 'bg-primary/10 border-primary/20' : ''}`}
            >
              {editingBundles.has(bundle.name) ? (
                <X className="w-3 h-3" />
              ) : (
                <Edit3 className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground mb-3">
          <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
            <span>{bundle.fileCount} files</span>
            <span>•</span>
            <span>{(bundle.size / 1024).toFixed(1)}kb</span>
            {bundle.lastGenerated && (
              <>
                <span>•</span>
                <span className="truncate max-w-[200px]">
                  Generated {new Date(bundle.lastGenerated).toLocaleTimeString()}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {/* Bundle Files */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs font-normal h-5">
                Files
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({currentBundle.files.length} files)
              </span>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {editingBundles.has(bundle.name) ? (
                // Edit mode: show files with remove buttons
                currentBundle.files.map((file) => {
                  const removeKey = `remove-${bundle.name}-${file}`
                  const isLoading = loadingButtons.has(removeKey)
                  const fileBundles = getFileBundles(file).filter(b => b !== bundle.name)
                  const fileName = file.split('/').pop() || file
                  return (
                    <div key={file} className="flex items-center gap-2 py-0.5 px-1 hover:bg-muted/50 rounded-sm group">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFileFromBundle(file, bundle.name)}
                        disabled={isLoading || bundle.name === 'master'}
                        className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 flex-shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <Minus className="w-2.5 h-2.5 text-destructive" />
                        )}
                      </Button>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="flex-shrink-0">{getFileIcon(file)}</div>
                        <span className="text-xs text-foreground truncate font-normal">{fileName}</span>
                        {fileBundles.length > 0 && (
                          <div className="flex gap-1 flex-wrap ml-auto">
                            {fileBundles.map(bundleName => (
                              <Badge key={bundleName} variant="outline" className="text-xs font-normal h-4 px-1.5">
                                {bundleName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                // View mode: show files with bundle labels
                currentBundle.files.map((file) => {
                  const fileBundles = getFileBundles(file).filter(b => b !== bundle.name)
                  const fileName = file.split('/').pop() || file
                  return (
                    <div key={file} className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-muted/30 rounded-sm">
                      <div className="flex-shrink-0">{getFileIcon(file)}</div>
                      <span className="text-xs text-foreground truncate flex-1 font-normal">{fileName}</span>
                      {fileBundles.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {fileBundles.map(bundleName => (
                            <Badge key={bundleName} variant="outline" className="text-xs font-normal h-4 px-1.5">
                              {bundleName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Available Files Section (Edit Mode Only) */}
          {editingBundles.has(bundle.name) && (
            <div className="space-y-2 mt-4 pt-3 border-t">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-normal h-5">
                  <Plus className="w-2.5 h-2.5 mr-1" />
                  Available Files
                </Badge>
                <span className="text-xs text-muted-foreground">
                  (Click + to add to bundle)
                </span>
              </div>
              <div className="mb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={availableFilesSearch}
                    onChange={(e) => setAvailableFilesSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1 text-xs border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {availableFiles
                  .filter(file => !currentBundle.files.includes(file))
                  .filter(file => availableFilesSearch === '' || file.toLowerCase().includes(availableFilesSearch.toLowerCase()))
                  .map((file) => {
                    const addKey = `add-${currentBundle.name}-${file}`
                    const isLoading = loadingButtons.has(addKey)
                    const fileBundles = getFileBundles(file)
                    const fileName = file.split('/').pop() || file
                    return (
                      <div key={file} className="flex items-center gap-2 py-0.5 px-1 hover:bg-muted/50 rounded-sm group">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addFileToBundle(file, currentBundle.name)}
                          disabled={isLoading}
                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-primary/10 flex-shrink-0"
                        >
                          {isLoading ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Plus className="w-2.5 h-2.5 text-primary" />
                          )}
                        </Button>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className="flex-shrink-0">{getFileIcon(file)}</div>
                          <span className="text-xs text-muted-foreground truncate font-normal">{fileName}</span>
                          {fileBundles.length > 0 && (
                            <div className="flex gap-1 flex-wrap ml-auto">
                              {fileBundles.map(bundleName => (
                                <Badge key={bundleName} variant="outline" className="text-xs font-normal h-4 px-1.5">
                                  {bundleName}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  )
}
