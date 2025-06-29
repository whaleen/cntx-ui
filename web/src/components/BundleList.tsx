/* eslint-disable @typescript-eslint/no-explicit-any */
// web/src/components/BundleList.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RefreshCw, X, Layers, TreePine, BarChart3, File } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'

// Import new bundle components
import {
  BundleCard,
  BundleDetails,
  ProjectFiles,
  FileAnalysis,
  BundleLegend,
  useFileSizes,
  type Bundle,
  type FileInfo
} from './bundles'

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

export function BundleList() {
  const queryClient = useQueryClient()
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null)
  const [editingBundles, setEditingBundles] = useState<Set<string>>(new Set())
  const [loadingButtons, setLoadingButtons] = useState<Set<string>>(new Set())

  // Get file sizes
  const fileSizes = useFileSizes()

  // Use React Query for proper state management
  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['bundles'],
    queryFn: fetchBundles,
    refetchInterval: 5000,
    refetchOnWindowFocus: true
  })
  const { data: allFiles = [] } = useQuery({
    queryKey: ['allFiles'],
    queryFn: fetchAllFiles,
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  })

  // Calculate available files: all project files (BundleDetails will filter based on current bundle)
  const availableFiles = (() => {
    if (!allFiles || !bundles) return []
    return allFiles
  })()

  const selectBundle = (bundleName: string) => {
    setSelectedBundle(selectedBundle === bundleName ? null : bundleName)
  }

  // FIX: Real edit mode toggle
  const toggleEditMode = (bundleName: string) => {
    setEditingBundles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bundleName)) {
        newSet.delete(bundleName)
      } else {
        newSet.add(bundleName)
      }
      return newSet
    })
  }

  const getFileBundles = (filePath: string) => {
    return bundles.filter(bundle => bundle.files.includes(filePath)).map(b => b.name)
  }

  const isFileOnlyInMaster = (filePath: string) => {
    const fileBundles = getFileBundles(filePath)
    return fileBundles.length === 1 && fileBundles[0] === 'master'
  }

  const hasUnassignedFiles = (bundle: Bundle) => {
    return bundle.files.some(file => isFileOnlyInMaster(file))
  }

  // --- Add/Remove Functions ---
  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bundles'] })
    await queryClient.invalidateQueries({ queryKey: ['allFiles'] })
  }

  // --- Bundle Action Functions ---
  const regenerateBundle = async (bundleName: string) => {
    const key = `regen-${bundleName}`
    setLoadingButtons(prev => new Set(prev).add(key))
    try {
      const response = await fetch(`http://localhost:3333/api/regenerate/${bundleName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to regenerate bundle: ${response.status} ${errorText}`)
      }
      await invalidateAll()
      toast.success(`Regenerated ${bundleName}`)
    } catch (error) {
      console.error('Regenerate bundle error:', error)
      toast.error(`Failed to regenerate bundle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet })
    }
  }

  const copyBundle = async (bundleName: string) => {
    const key = `copy-${bundleName}`
    setLoadingButtons(prev => new Set(prev).add(key))
    try {
      // TODO: Implement copy API endpoint
      toast.error('Copy functionality not yet implemented')
    } catch (error) {
      console.error('Copy bundle error:', error)
      toast.error(`Failed to copy bundle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet })
    }
  }

  const downloadBundle = async (bundleName: string) => {
    const key = `download-${bundleName}`
    setLoadingButtons(prev => new Set(prev).add(key))
    try {
      // TODO: Implement download API endpoint
      toast.error('Download functionality not yet implemented')
    } catch (error) {
      console.error('Download bundle error:', error)
      toast.error(`Failed to download bundle: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet })
    }
  }

  const removeFileFromBundle = async (fileName: string, bundleName: string) => {
    const key = `remove-${bundleName}-${fileName}`
    setLoadingButtons(prev => new Set(prev).add(key))
    try {
      const response = await fetch('http://localhost:3333/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-file', bundleName, fileName })
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to remove file from bundle: ${response.status} ${errorText}`)
      }
      await invalidateAll()
      toast.success(`Removed ${fileName} from ${bundleName}`)
    } catch (error) {
      console.error('Remove file error:', error)
      toast.error(`Failed to remove file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet })
    }
  }

  const addFileToBundle = async (fileName: string, bundleName: string) => {
    const key = `add-${bundleName}-${fileName}`
    setLoadingButtons(prev => new Set(prev).add(key))
    try {
      const response = await fetch('http://localhost:3333/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-file', bundleName, fileName })
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to add file to bundle: ${response.status} ${errorText}`)
      }
      await invalidateAll()
      toast.success(`Added ${fileName} to ${bundleName}`)
    } catch (error) {
      console.error('Add file error:', error)
      toast.error(`Failed to add file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet })
    }
  }

  const addFilesToBundle = async (fileNames: string[], bundleName: string) => {
    const key = `bulk-add-${bundleName}`
    setLoadingButtons(prev => new Set(prev).add(key))
    try {
      const response = await fetch('http://localhost:3333/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-add-files', bundleName, fileNames })
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to add files to bundle: ${response.status} ${errorText}`)
      }
      await invalidateAll()
      toast.success(`Added ${fileNames.length} files to ${bundleName}`)
    } catch (error) {
      console.error('Bulk add files error:', error)
      toast.error(`Failed to add files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet })
    }
  }

  const removeFilesFromBundle = async (fileNames: string[], bundleName: string) => {
    const key = `bulk-remove-${bundleName}`
    setLoadingButtons(prev => new Set(prev).add(key))
    try {
      const response = await fetch('http://localhost:3333/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-remove-files', bundleName, fileNames })
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to remove files from bundle: ${response.status} ${errorText}`)
      }
      await invalidateAll()
      toast.success(`Removed ${fileNames.length} files from ${bundleName}`)
    } catch (error) {
      console.error('Bulk remove files error:', error)
      toast.error(`Failed to remove files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingButtons(prev => { const newSet = new Set(prev); newSet.delete(key); return newSet })
    }
  }

  if (isLoading) return <div>Loading bundles...</div>
  if (!bundles) return <div>No bundles found</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <BundleLegend undercategorizedFilesCount={bundles.filter(b => b.name === 'master').flatMap(b => b.files.filter(f => isFileOnlyInMaster(f))).length} />
        <Button onClick={invalidateAll} variant="ghost" size="sm">
          <RefreshCw className="mr-1" />
        </Button>
      </div>
      <Tabs defaultValue="bundles" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-background">
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
            {bundles.filter(b => b.name === 'master').flatMap(b => b.files.filter(f => isFileOnlyInMaster(f))).length > 0 && (
              <Badge variant="outline" className="ml-1 bg-warning/10 text-warning border-warning/20 h-4 px-1 text-xs">
                {bundles.filter(b => b.name === 'master').flatMap(b => b.files.filter(f => isFileOnlyInMaster(f))).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bundles" className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className={`${selectedBundle ? 'hidden lg:block lg:w-1/2' : 'w-full'} transition-all`}>
              <div className={`grid grid-cols-1 gap-4 ${selectedBundle ? 'md:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
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
                    successButtons={new Set()}
                    errorButtons={new Set()}
                    hasUnassignedFiles={hasUnassignedFiles(bundle)}
                  />
                )) : <div>No bundles available</div>}
              </div>
            </div>
            {selectedBundle && (
              <div className={`${selectedBundle ? 'block' : 'hidden'} ${selectedBundle ? 'fixed inset-0 z-50 bg-background lg:relative lg:inset-auto lg:z-auto lg:w-1/2' : ''} transition-all flex flex-col`}>
                <div className="lg:hidden sticky top-0 bg-background border-b p-4 flex justify-between items-center flex-shrink-0">
                  <h3 className="font-thin">Bundle Details</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBundle(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 lg:p-0">
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
            undercategorizedFiles={bundles.filter(b => b.name === 'master').flatMap(b => b.files.filter(f => isFileOnlyInMaster(f)).map(f => ({ path: f, bundles: ['master'] })))}
            bundles={bundles}
            addFileToBundle={addFileToBundle}
            loadFileAnalysis={invalidateAll}
            loadingButtons={loadingButtons}
            setButtonState={() => { }}
            onRemoveFile={() => { }}
            fileSizes={fileSizes}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
