// Shared utilities for bundle components
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { File, Folder, FolderOpen } from 'lucide-react'

// File size formatting function
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Hook to fetch file sizes
export const useFileSizes = () => {
  const { data: fileSizes = {} } = useQuery({
    queryKey: ['fileSizes'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3333/api/files')
      if (!response.ok) throw new Error('Failed to fetch files')
      const files = await response.json()
      const sizes: Record<string, number> = {}
      files.forEach((file: any) => {
        sizes[file.path] = file.size || 0
      })
      return sizes
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
  return fileSizes
}

// Hook to get bundle suggestions for a file path
export const useBundleSuggestions = (filePath: string) => {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!filePath) return

    setLoading(true)
    suggestBundleForFile(filePath)
      .then(setSuggestions)
      .catch((error) => {
        console.warn('Failed to get suggestions for', filePath, error)
        setSuggestions([])
      })
      .finally(() => setLoading(false))
  }, [filePath])

  return { suggestions, loading }
}

// Get heuristics manager for bundle suggestions
let heuristicsManager = null
const getHeuristicsManager = async () => {
  if (!heuristicsManager) {
    // Dynamic import for browser-compatible version
    const { default: HeuristicsManagerBrowser } = await import(
      '../../lib/heuristics-manager-browser.js'
    )
    heuristicsManager = new HeuristicsManagerBrowser()
  }
  return heuristicsManager
}

// Suggest bundle for file using heuristics
export const suggestBundleForFile = async (
  filePath: string
): Promise<string[]> => {
  try {
    const manager = await getHeuristicsManager()
    return await manager.suggestBundlesForFile(filePath)
  } catch (error) {
    console.warn(
      'Failed to get bundle suggestions from heuristics manager, using fallback:',
      error
    )

    // Fallback to original hardcoded logic
    const fileName = filePath.toLowerCase()
    const pathParts = fileName.split('/')
    const suggestions: string[] = []

    if (pathParts.includes('web') || pathParts.includes('components')) {
      suggestions.push('frontend')
      if (pathParts.includes('components')) {
        suggestions.push('ui-components')
      }
    }

    if (
      fileName.includes('server') ||
      fileName.includes('api') ||
      pathParts.includes('bin')
    ) {
      suggestions.push('server')
    }

    if (
      fileName.includes('config') ||
      fileName.includes('setup') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.sh') ||
      fileName.includes('package')
    ) {
      suggestions.push('config')
    }

    if (
      fileName.endsWith('.md') ||
      fileName.includes('doc') ||
      fileName.includes('readme')
    ) {
      suggestions.push('docs')
    }

    if (suggestions.length === 0) {
      if (pathParts.includes('web')) {
        suggestions.push('frontend')
      } else {
        suggestions.push('server', 'config')
      }
    }

    return suggestions
  }
}

// Get file icon configuration based on file extension
export const getFileIconConfig = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const iconClass = 'w-4 h-4'

  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return {
        className: `${iconClass} text-[color:var(--color-warning)]`,
      }
    case 'json':
      return {
        className: `${iconClass} text-[color:var(--color-success)]`,
      }
    case 'md':
      return {
        className: `${iconClass} text-[color:var(--color-info)]/80`,
      }
    case 'css':
    case 'scss':
      return {
        className: `${iconClass} text-[color:var(--color-type-styles)]`,
      }
    case 'html':
      return {
        className: `${iconClass} text-[color:var(--color-type-configuration)]`,
      }
    default:
      return {
        className: `${iconClass} text-muted-foreground`,
      }
  }
}

// Check if a file is only in the master bundle
export const isFileOnlyInMaster = (filePath: string, bundles: any[]) => {
  const fileBundles = bundles
    .filter((bundle) => bundle.files.includes(filePath))
    .map((b) => b.name)
  return fileBundles.length === 1 && fileBundles[0] === 'master'
}

// Check if a bundle has unassigned files
export const hasUnassignedFiles = (bundle: any, bundles: any[]) => {
  return bundle.files.some((file: string) => isFileOnlyInMaster(file, bundles))
}

// Get undercategorized files
export const getUndercategorizedFiles = (bundles: any[]) => {
  return bundles
    .filter((bundle) => bundle.name === 'master')
    .flatMap((bundle) =>
      bundle.files
        .filter((file: string) => isFileOnlyInMaster(file, bundles))
        .map((file: string) => ({
          path: file,
          bundles: ['master'],
        }))
    )
}
