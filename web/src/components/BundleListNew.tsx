/* eslint-disable @typescript-eslint/no-explicit-any */
// web/src/components/BundleListNew.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RefreshCw, X, Layers, TreePine, BarChart3, File } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/lib/toast'

// Import new bundle components
import {
  BundleCard,
  BundleDetails,
  ProjectFiles,
  FileAnalysis,
  useFileSizes,
  type Bundle,
  type FileInfo
} from './bundles'

const fetchBundles = async (): Promise<Bundle[]> => {
  const response = await fetch('http://localhost:3333/api/bundles')
  if (!response.ok) throw new Error('Failed to fetch bundles')
  return response.json()
}

export function BundleListNew() {
  const queryClient = useQueryClient()
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null)
  const [editingBundles, setEditingBundles] = useState<Set<string>>(new Set())
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [undercategorizedFiles, setUndercategorizedFiles] = useState<FileInfo[]>([])
  const [loadingButtons, setLoadingButtons] = useState<Set<string>>(new Set())
  const [successButtons, setSuccessButtons] = useState<Set<string>>(new Set())
  const [errorButtons, setErrorButtons] = useState<Set<string>>(new Set())

  // Get file sizes
  const fileSizes = useFileSizes()

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

  // Get which bundles a file belongs to using the actual bundle data
  const getFileBundles = (filePath: string) => {
    return bundles.filter(bundle => bundle.files.includes(filePath)).map(b => b.name)
  }

  // Check if a file is only in the master bundle (needs better assignment)
  const isFileOnlyInMaster = (filePath: string) => {
    const fileBundles = getFileBundles(filePath)
    return fileBundles.length === 1 && fileBundles[0] === 'master'
  }

  // Check if a bundle has unassigned files
  const hasUnassignedFiles = (bundle: Bundle) => {
    return bundle.files.some(file => isFileOnlyInMaster(file))
  }

  // Get undercategorized files (files only in master bundle)
  const getUndercategorizedFiles = () => {
    return bundles
      .filter(bundle => bundle.name === 'master')
      .flatMap(bundle =>
        bundle.files
          .filter(file => isFileOnlyInMaster(file))
          .map(file => ({
            path: file,
            bundles: ['master']
          }))
      )
  }

  // Get file icon based on file extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const iconClass = "w-4 h-4"

    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return <File className={`${iconClass} text-[color:var(--color-warning)]`} />
      case 'json':
        return <File className={`${iconClass} text-[color:var(--color-success)]`} />
      case 'md':
        return <File className={`${iconClass} text-[color:var(--color-info)]/80`} />
      case 'css':
      case 'scss':
        return <File className={`${iconClass} text-[color:var(--color-type-styles)]`} />
      case 'html':
        return <File className={`${iconClass} text-[color:var(--color-type-configuration)]`} />
      default:
        return <File className={`${iconClass} text-muted-foreground`} />
    }
  }

  const toggleEditMode = async (bundleName: string) => {
    const newEditingBundles = new Set(editingBundles)
    if (newEditingBundles.has(bundleName)) {
      newEditingBundles.delete(bundleName)
    } else {
      newEditingBundles.add(bundleName)
    }
    setEditingBundles(newEditingBundles)
  }

  const removeFileFromBundle = async (fileName: string, bundleName: string) => {
    const key = `remove-${bundleName}-${fileName}`
    setLoadingButtons(prev => new Set(prev).add(key))

    try {
      const response = await fetch('http://localhost:3333/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-file',
          bundleName,
          fileName
        })
      })

      if (!response.ok) throw new Error('Failed to remove file from bundle')

      await refetch()
      toast.success(`Removed ${fileName} from ${bundleName}`)
    } catch (error) {
      toast.error(`Failed to remove file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  const addFileToBundle = async (fileName: string, bundleName: string) => {
    const key = `add-${bundleName}-${fileName}`
    setLoadingButtons(prev => new Set(prev).add(key))

    try {
      const response = await fetch('http://localhost:3333/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-file',
          bundleName,
          fileName
        })
      })

      if (!response.ok) throw new Error('Failed to add file to bundle')

      await refetch()
      toast.success(`Added ${fileName} to ${bundleName}`)
    } catch (error) {
      toast.error(`Failed to add file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  const addFilesToBundle = async (fileNames: string[], bundleName: string) => {
    const key = `bulk-add-${bundleName}`
    setLoadingButtons(prev => new Set(prev).add(key))

    try {
      const response = await fetch('http://localhost:3333/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-add-files',
          bundleName,
          fileNames
        })
      })

      if (!response.ok) throw new Error('Failed to add files to bundle')

      await refetch()
      toast.success(`Added ${fileNames.length} files to ${bundleName}`)
    } catch (error) {
      toast.error(`Failed to add files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  const removeFilesFromBundle = async (fileNames: string[], bundleName: string) => {
    const key = `bulk-remove-${bundleName}`
    setLoadingButtons(prev => new Set(prev).add(key))

    try {
      const response = await fetch('http://localhost:3333/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-remove-files',
          bundleName,
          fileNames
        })
      })

      if (!response.ok) throw new Error('Failed to remove files from bundle')

      await refetch()
      toast.success(`Removed ${fileNames.length} files from ${bundleName}`)
    } catch (error) {
      toast.error(`Failed to remove files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  const setButtonState = (key: string, state: 'loading' | 'success' | 'error' | 'idle') => {
    if (state === 'loading') {
      setLoadingButtons(prev => new Set(prev).add(key))
      setSuccessButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
      setErrorButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    } else if (state === 'success') {
      setLoadingButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
      setSuccessButtons(prev => new Set(prev).add(key))
      setErrorButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    } else if (state === 'error') {
      setLoadingButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
      setSuccessButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
      setErrorButtons(prev => new Set(prev).add(key))
    } else {
      setLoadingButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
      setSuccessButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
      setErrorButtons(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
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
      // Use local calculation for undercategorized files
      const undercategorized = getUndercategorizedFiles()
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

  const manualRefresh = async () => {
    console.log('Manual refresh triggered')
    queryClient.removeQueries({ queryKey: ['bundles'] })
    const result = await refetch()
    console.log('Fresh bundles data:', result.data)

    // Also refresh file analysis
    await loadFileAnalysis()
  }

  const handleRemoveUndercategorized = (filePath: string) => {
    setUndercategorizedFiles(prev => prev.filter(f => f.path !== filePath))
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center flex-shrink-0">
        <div className="text-sm text-muted-foreground">
          {undercategorizedFiles.length > 0 && (
            <Badge variant="secondary">
              {undercategorizedFiles.length} uncategorized files
            </Badge>
          )}
        </div>
        <Button onClick={manualRefresh} variant="ghost" size="sm">
          <RefreshCw className="mr-1" />
        </Button>
      </div>

      <Tabs defaultValue="bundles" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 bg-background flex-shrink-0">
          <TabsTrigger value="bundles" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Bundles
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <TreePine className="w-4 h-4" />
            Project Files
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            File Analysis
            {undercategorizedFiles.length > 0 && (
              <Badge variant="outline" className="ml-1 bg-warning/10 text-warning border-warning/20 h-4 px-1 text-xs">
                {undercategorizedFiles.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bundles" className="flex-1 flex flex-col min-h-0">
          {/* Responsive Layout */}
          <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
            {/* Bundle Grid */}
            <div className={`${selectedBundle ? 'hidden lg:block lg:w-1/2' : 'w-full'} transition-all flex-shrink-0`}>
              <div className={`grid grid-cols-1 gap-4 ${selectedBundle
                ? 'md:grid-cols-2'
                : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                }`}>
                {bundles && Array.isArray(bundles) ? bundles.map((bundle) => (
                  <BundleCard
                    key={bundle.name}
                    bundle={bundle}
                    isSelected={selectedBundle === bundle.name}
                    onSelect={selectBundle}
                    onRegenerate={regenerateBundle}
                    onCopy={copyBundle}
                    onDownload={downloadBundle}
                    loadingButtons={loadingButtons}
                    successButtons={successButtons}
                    errorButtons={errorButtons}
                    hasUnassignedFiles={hasUnassignedFiles(bundle)}
                  />
                )) : <div>No bundles available</div>}
              </div>
            </div>

            {/* Detail Panel */}
            {selectedBundle && (
              <div className={`${selectedBundle ? 'block' : 'hidden'} ${selectedBundle ? 'fixed inset-0 z-50 bg-background lg:relative lg:inset-auto lg:z-auto lg:w-1/2' : ''
                } transition-all flex flex-col flex-1 min-h-0`}>
                {/* Mobile Close Button */}
                <div className="lg:hidden sticky top-0 bg-background border-b p-4 flex justify-between items-center flex-shrink-0">
                  <h3 className="font-thin">Bundle Details</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBundle(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex-1 overflow-hidden p-4 lg:p-0">
                  {(() => {
                    const bundle = bundles?.find((b: Bundle) => b.name === selectedBundle)
                    if (!bundle) return <div>Bundle not found</div>

                    return (
                      <BundleDetails
                        bundle={bundle}
                        bundles={bundles}
                        selectedBundleName={selectedBundle}
                        editingBundles={editingBundles}
                        availableFiles={availableFiles}
                        loadingButtons={loadingButtons}
                        toggleEditMode={toggleEditMode}
                        removeFileFromBundle={removeFileFromBundle}
                        addFileToBundle={addFileToBundle}
                        addFilesToBundle={addFilesToBundle}
                        removeFilesFromBundle={removeFilesFromBundle}
                        getFileBundles={getFileBundles}
                        fileSizes={fileSizes}
                      />
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <ProjectFiles />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <FileAnalysis
            undercategorizedFiles={undercategorizedFiles}
            bundles={bundles}
            addFileToBundle={addFileToBundle}
            loadFileAnalysis={loadFileAnalysis}
            loadingButtons={loadingButtons}
            setButtonState={setButtonState}
            onRemoveFile={handleRemoveUndercategorized}
            fileSizes={fileSizes}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
} 
