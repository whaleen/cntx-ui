import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card } from './ui/card'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileNode[]
  bundles?: string[]
}

interface Bundle {
  name: string
  files: string[]
}

const fetchBundles = async (): Promise<Bundle[]> => {
  const response = await fetch('/api/bundles')
  if (!response.ok) throw new Error('Failed to fetch bundles')
  return response.json()
}

const buildFileTree = (bundles: Bundle[]): FileNode => {
  const root: FileNode = { name: '', path: '', type: 'directory', children: [] }
  const allFiles = new Set<string>()
  const fileBundleMap = new Map<string, string[]>()

  try {
    // Collect all files and their bundle associations
    bundles.forEach(bundle => {
      if (!bundle || !Array.isArray(bundle.files)) return;
      
      bundle.files.forEach(file => {
        if (!file || typeof file !== 'string') return;
        allFiles.add(file)
        if (!fileBundleMap.has(file)) {
          fileBundleMap.set(file, [])
        }
        fileBundleMap.get(file)!.push(bundle.name)
      })
    })

    // Build tree structure
    allFiles.forEach(filePath => {
      const parts = filePath.split('/').filter(Boolean)
      let current = root

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1
        const currentPath = parts.slice(0, index + 1).join('/')

        if (!current.children) current.children = []

        let existing = current.children.find(child => child.name === part)

        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            children: isFile ? undefined : [],
            bundles: isFile ? fileBundleMap.get(filePath) : undefined
          }
          current.children.push(existing)
        }

        if (!isFile) {
          current = existing
        }
      })
    })

    // Sort: directories first, then files, alphabetically
    const sortChildren = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })
        node.children.forEach(sortChildren)
      }
    }

    sortChildren(root)
  } catch (e) {
    console.error('Error building file tree:', e)
  }
  return root
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const iconClass = "w-4 h-4"

  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return <File className={`${iconClass} text-warning`} />
    case 'json':
      return <File className={`${iconClass} text-success`} />
    case 'md':
      return <File className={`${iconClass} text-info`} />
    case 'css':
    case 'scss':
      return <File className={`${iconClass} text-primary`} />
    case 'html':
      return <File className={`${iconClass} text-primary`} />
    default:
      return <File className={`${iconClass} text-muted-foreground`} />
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface FileTreeNodeProps {
  node: FileNode
  level: number
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
}

function FileTreeNode({ node, level, expandedDirs, onToggleDir }: FileTreeNodeProps) {
  const isExpanded = expandedDirs.has(node.path)
  const indent = level * 12

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded transition-colors cursor-pointer"
          onClick={() => onToggleDir(node.path)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-primary" />
          ) : (
            <Folder className="w-4 h-4 text-primary" />
          )}
          <span className="text-xs ">{node.name}</span>
          {node.children && (
            <span className="text-xs text-muted-foreground ml-auto">
              {node.children.length} items
            </span>
          )}
        </div>

        {isExpanded && node.children && (
          <div className="ml-4 border-l border-border/50 pl-2">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                level={level + 1}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded transition-colors ml-6"
    >
      {getFileIcon(node.name)}
      <span className="text-xs font-mono">{node.name}</span>

      {node.bundles && node.bundles.length > 0 && (
        <div className="flex gap-1 ml-2">
          {node.bundles.map(bundle => (
            <Badge
              key={bundle}
              variant="outline"
              className="text-xs px-1 py-0 h-4"
            >
              {bundle}
            </Badge>
          ))}
        </div>
      )}

      {node.size && (
        <span className="text-xs text-muted-foreground ml-auto">
          {formatFileSize(node.size)}
        </span>
      )}
    </div>
  )
}

export function FileTree() {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']))
   
  // const [showUnbundled, setShowUnbundled] = useState(false)

  const { data: bundles, isLoading } = useQuery({
    queryKey: ['bundles'],
    queryFn: fetchBundles,
    refetchInterval: 5000,
  })

  const handleToggleDir = (path: string) => {
    const newExpanded = new Set(expandedDirs)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedDirs(newExpanded)
  }

  const expandAll = () => {
    if (!bundles) return
    const tree = buildFileTree(bundles)
    const allDirs = new Set<string>()

    const collectDirs = (node: FileNode) => {
      if (node.type === 'directory') {
        allDirs.add(node.path)
        node.children?.forEach(collectDirs)
      }
    }

    collectDirs(tree)
    setExpandedDirs(allDirs)
  }

  const collapseAll = () => {
    setExpandedDirs(new Set(['']))
  }

  if (isLoading) return <div>Loading file tree...</div>
  if (!bundles) return <div>No bundles found</div>

  const tree = useMemo(() => buildFileTree(bundles), [bundles])
  const totalFiles = useMemo(() => bundles.reduce((acc, bundle) => acc + (bundle.files?.length || 0), 0), [bundles])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>

        <div className="text-xs text-muted-foreground ">
          {totalFiles} files tracked
        </div>
      </div>

      {/* File Tree */}
      <Card className="p-4">
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {tree.children && tree.children.length > 0 ? (
            tree.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                level={0}
                expandedDirs={expandedDirs}
                onToggleDir={handleToggleDir}
              />
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No files found
            </div>
          )}
        </div>
      </Card>

      {/* Bundle Legend */}
      <Card className="p-4">
        <h3 className="text-xs  mb-2">Bundle Legend</h3>
        <div className="flex flex-wrap gap-2">
          {bundles.map(bundle => (
            <Badge key={bundle.name} variant="outline">
              {bundle.name} ({bundle.files?.length || 0})
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}
