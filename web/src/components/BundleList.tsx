/* eslint-disable @typescript-eslint/no-explicit-any */
// web/src/components/BundleList.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { X, Boxes, TreePine, BarChart3, AlertTriangle } from 'lucide-react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from '@/lib/toast'

// Import new bundle components
import {
  BundleCard,
  BundleDetails,
  ProjectFiles,
  FileAnalysis,
  useFileSizes,
  type Bundle,
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
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [bundleUpdates, setBundleUpdates] = useState<Map<string, { changed: boolean, lastSync: Date }>>(new Map())
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)

  // Get file sizes
  const fileSizes = useFileSizes()

  // Use React Query for proper state management
  const { data: bundles = [], isLoading, isFetching: isFetchingBundles, dataUpdatedAt: bundlesUpdatedAt } = useQuery({
    queryKey: ['bundles'],
    queryFn: fetchBundles,
    refetchInterval: 5000,
    refetchOnWindowFocus: true
  })
  const { data: allFiles = [], isFetching: isFetchingFiles, dataUpdatedAt: filesUpdatedAt } = useQuery({
    queryKey: ['allFiles'],
    queryFn: fetchAllFiles,
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  })

  // Track when data was last updated
  useEffect(() => {
    const latestUpdate = Math.max(bundlesUpdatedAt, filesUpdatedAt)
    if (latestUpdate > 0) {
      setLastRefresh(new Date(latestUpdate))
    }
  }, [bundlesUpdatedAt, filesUpdatedAt])

  // WebSocket connection for real-time bundle updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3333')

    ws.onopen = () => {
      console.log('Bundle updates WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        console.log('WebSocket message received:', update)

        switch (update.type) {
          case 'bundle-sync-started':
            setBundleUpdates(prev => new Map(prev).set(update.bundleName, {
              changed: true,
              lastSync: new Date(update.timestamp)
            }))
            toast.info(`Syncing ${update.bundleName}`)
            break

          case 'bundle-sync-completed':
            setBundleUpdates(prev => new Map(prev).set(update.bundleName, {
              changed: false,
              lastSync: new Date(update.timestamp)
            }))
            toast.success(`Synced ${update.bundleName}`)
            // Also invalidate queries to get fresh data
            queryClient.invalidateQueries({ queryKey: ['bundles'] })
            break

          case 'bundle-sync-failed':
            setBundleUpdates(prev => new Map(prev).set(update.bundleName, {
              changed: true,
              lastSync: new Date(update.timestamp)
            }))
            toast.error(`Sync failed for ${update.bundleName}`, update.error)
            break

          case 'bundle-file-changed':
            setBundleUpdates(prev => new Map(prev).set(update.bundleName, {
              changed: true,
              lastSync: new Date(update.timestamp)
            }))
            break
        }
      } catch (error) {
        console.error('Error parsing bundle update:', error)
      }
    }

    ws.onclose = () => {
      console.log('Bundle updates WebSocket disconnected')
    }

    ws.onerror = (error) => {
      console.error('Bundle updates WebSocket error:', error)
    }

    return () => {
      ws.close()
    }
  }, [queryClient])

  // Calculate available files: all project files (BundleDetails will filter based on current bundle)
  const availableFiles = (() => {
    if (!allFiles || !bundles) return []
    return allFiles
  })()

  const selectBundle = useCallback((bundleName: string) => {
    setSelectedBundle(selectedBundle === bundleName ? null : bundleName)
  }, [selectedBundle])

  // FIX: Real edit mode toggle
  const toggleEditMode = useCallback((bundleName: string) => {
    setEditingBundles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bundleName)) {
        newSet.delete(bundleName)
      } else {
        newSet.add(bundleName)
      }
      return newSet
    })
  }, [])

  const getFileBundles = useCallback((filePath: string) => {
    return bundles.filter(bundle => bundle.files.includes(filePath)).map(b => b.name)
  }, [bundles])

  const isFileOnlyInMaster = useCallback((filePath: string) => {
    const fileBundles = getFileBundles(filePath)
    return fileBundles.length === 1 && fileBundles[0] === 'master'
  }, [getFileBundles])

  const hasUnassignedFiles = useCallback((bundle: Bundle) => {
    return bundle.files.some(file => isFileOnlyInMaster(file))
  }, [isFileOnlyInMaster])

  // Memoize undercategorized files calculation to prevent unnecessary re-computations
  const undercategorizedFiles = useMemo(() => {
    return bundles
      .filter(b => b.name === 'master')
      .flatMap(b => b.files.filter(f => isFileOnlyInMaster(f)))
      .map(f => ({ path: f, bundles: ['master'] }))
  }, [bundles])

  const undercategorizedFilesCount = useMemo(() => {
    return undercategorizedFiles.length
  }, [undercategorizedFiles])

  // Memoize bundle processing to avoid recalculating on every render
  const processedBundles = useMemo(() => {
    return bundles.map((bundle) => {
      const realtimeUpdate = bundleUpdates.get(bundle.name)
      return {
        ...bundle,
        changed: realtimeUpdate?.changed ?? bundle.changed,
        lastSync: realtimeUpdate?.lastSync
      }
    })
  }, [bundles, bundleUpdates])

  // Memoize expensive calculations
  const bundleStats = useMemo(() => {
    return bundles.map(bundle => ({
      name: bundle.name,
      hasUnassignedFiles: hasUnassignedFiles(bundle)
    }))
  }, [bundles])

  // --- Add/Remove Functions ---
  const invalidateAll = useCallback(async () => {
    setIsManualRefreshing(true)
    try {
      // Use Promise.all to run queries in parallel
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bundles'] }),
        queryClient.invalidateQueries({ queryKey: ['allFiles'] })
      ])
      toast.success('Data refreshed')
    } catch (error) {
      toast.error('Failed to refresh data')
    } finally {
      setIsManualRefreshing(false)
    }
  }, [queryClient])

  // --- Bundle Action Functions ---
  const regenerateBundle = useCallback(async (bundleName: string) => {
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
  }, [invalidateAll])

  const copyBundle = useCallback(async (bundleName: string) => {
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
  }, [])

  const downloadBundle = useCallback(async (bundleName: string) => {
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
  }, [])

  const removeFileFromBundle = useCallback(async (fileName: string, bundleName: string) => {
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
  }, [invalidateAll])

  const addFileToBundle = useCallback(async (fileName: string, bundleName: string) => {
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
  }, [invalidateAll])

  const addFilesToBundle = useCallback(async (fileNames: string[], bundleName: string) => {
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
  }, [invalidateAll])

  const removeFilesFromBundle = useCallback(async (fileNames: string[], bundleName: string) => {
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
  }, [invalidateAll])

  if (isLoading) return <div>Loading bundles...</div>
  if (!bundles) return <div>No bundles found</div>

  return (
    <div className="h-full flex flex-col relative">
      <Tabs defaultValue="bundles" className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 bg-background">
          <TabsTrigger value="bundles" className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-muted-foreground/75" />
            Bundles
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <TreePine className="w-4 h-4 text-muted-foreground/75" />
            Project Files
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground/75" />
            File Analysis
            {undercategorizedFilesCount > 0 && (
              <Badge variant="outline" className="ml-1 bg-warning/10 text-warning border-warning/20 h-4 px-1 py-1 text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {undercategorizedFilesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bundles" className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {processedBundles && Array.isArray(processedBundles) ? processedBundles.map((bundle) => {
              const bundleStat = bundleStats.find(stat => stat.name === bundle.name)
              return (
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
                  hasUnassignedFiles={bundleStat?.hasUnassignedFiles ?? false}
                  lastRefresh={lastRefresh}
                />
              )
            }) : <div>No bundles available</div>}
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
            loadFileAnalysis={invalidateAll}
            loadingButtons={loadingButtons}
            setButtonState={() => { }}
            onRemoveFile={() => { }}
            fileSizes={fileSizes}
          />
        </TabsContent>
      </Tabs>

      {/* Bundle Details - Full screen overlay on all screen sizes */}
      {selectedBundle && (() => {
        const selectedBundleData = bundles.find((b: Bundle) => b.name === selectedBundle)
        if (!selectedBundleData) return null

        return (
          <div className="fixed top-0 left-0 right-0 bottom-10 z-50 bg-background flex flex-col">
            <div className="sticky top-0 bg-background border-b p-4 flex justify-between items-center flex-shrink-0">
              <h3 className="font-thin text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-muted-foreground" />
                Bundle Details
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedBundle(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <BundleDetails
                bundle={selectedBundleData}
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
                onBundleSelect={selectBundle}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}
