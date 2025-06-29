import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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
  const response = await fetch('http://localhost:3333/api/bundles')
  if (!response.ok) throw new Error('Failed to fetch bundles')
  return response.json()
}

const buildFileTree = (bundles: Bundle[]): FileNode => {
  const root: FileNode = { name: '', path: '', type: 'directory', children: [] }
  const allFiles = new Set<string>()
  const fileBundleMap = new Map<string, string[]>()

  // Collect all files and their bundle associations
  bundles.forEach(bundle => {
    bundle.files.forEach(file => {
      allFiles.add(file)
      if (!fileBundleMap.has(file)) {
        fileBundleMap.set(file, [])
      }
      fileBundleMap.get(file)!.push(bundle.name)
    })
  })

  // Build tree structure
  allFiles.forEach(filePath => {
    const parts = filePath.split('/')
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
  return root
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
  const indent = level * 16

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => onToggleDir(node.path)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-[color:var(--color-info)]" />
          ) : (
            <Folder className="w-4 h-4 text-[color:var(--color-info)]" />
          )}
          <span className="text-xs font-thin">{node.name}</span>
          {node.children && (
            <span className="text-xs text-muted-foreground ml-auto">
              {node.children.length} items
            </span>
          )}
        </div>

        {isExpanded && node.children && (
          <div>
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

  // File node
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
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

  return (
    <div
      className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded"
      style={{ paddingLeft: `${indent + 24}px` }}
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
  // wtf is this shit broseph? 
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

  const tree = buildFileTree(bundles)
  const totalFiles = bundles.reduce((acc, bundle) => acc + bundle.files.length, 0)

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

        <div className="text-xs text-muted-foreground font-thin">
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
        <h3 className="text-xs font-thin mb-2">Bundle Legend</h3>
        <div className="flex flex-wrap gap-2">
          {bundles.map(bundle => (
            <Badge key={bundle.name} variant="outline">
              {bundle.name} ({bundle.files.length})
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}
