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
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bundles" className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {processedBundles && Array.isArray(processedBundles) ? processedBundles.map((bundle) => {
              return (
                <BundleCard
                  key={bundle.name}
                  bundle={bundle}
                  isSelected={selectedBundle === bundle.name}
                  onSelect={selectBundle}
                  lastRefresh={lastRefresh || undefined}
                />
              )
            }) : <div>No bundles available</div>}
          </div>
        </TabsContent>
        <TabsContent value="files" className="space-y-4">
          <ProjectFiles />
        </TabsContent>
        <TabsContent value="analysis" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-thin uppercase tracking-widest">Semantic Analysis Active</p>
            <p className="text-xs mt-2 opacity-50">Viewing automated context mapping...</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bundle Details - Full screen overlay */}
      {selectedBundle && (() => {
        const selectedBundleData = bundles.find((b: any) => b.name === selectedBundle)
        if (!selectedBundleData) return null

        return (
          <div className="fixed top-0 left-0 right-0 bottom-10 z-50 bg-background flex flex-col">
            <div className="sticky top-0 bg-background border-b p-4 flex justify-between items-center flex-shrink-0">
              <h3 className="font-thin text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-muted-foreground" />
                {selectedBundle} Details
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedBundle(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
               <div className="space-y-4">
                  <h4 className="text-xs font-thin uppercase tracking-widest color-vesper-muted">Included Files</h4>
                  <ul className="list-none pl-0 space-y-1">
                    {selectedBundleData.files?.map((file: string) => (
                      <li key={file} className="text-xs font-thin mono py-1 border-b border-vesper/50">{file}</li>
                    ))}
                  </ul>
               </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
