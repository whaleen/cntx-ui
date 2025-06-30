import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Input } from '../ui/input'
import { Loader2, File, ExternalLink, Plus } from 'lucide-react'
import type { UndercategorizedFileRowProps } from './types'
import { useBundleSuggestions, formatFileSize, getFileIconConfig } from './utils'
import { toast } from '@/lib/toast'

export const UndercategorizedFileRow: React.FC<UndercategorizedFileRowProps> = ({
  fileInfo,
  bundles,
  addFileToBundle,
  loadFileAnalysis,
  loadingButtons,
  setButtonState,
  onRemove,
  fileSizes,
}) => {
  const { suggestions, loading } = useBundleSuggestions(fileInfo.path)
  const currentBundleText = fileInfo.bundles.length === 0 ? 'none' : fileInfo.bundles.join(', ')
  const [selectValue, setSelectValue] = useState<string>("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newBundleName, setNewBundleName] = useState("")
  const [creating, setCreating] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [selectLoading, setSelectLoading] = useState(false)

  // Bundles the file is NOT in, excluding master
  const availableBundles = bundles
    .map(b => b.name)
    .filter(name => name !== 'master' && !fileInfo.bundles.includes(name))

  const handleSelect = async (value: string) => {
    if (value === '__create__') {
      setDialogOpen(true)
      setSelectValue("")
    } else if (value === '__ignore__') {
      await handleIgnore()
      setSelectValue("")
    } else if (value) {
      setSelectLoading(true)
      const key = `add-${value}-${fileInfo.path}`
      setButtonState(key, 'loading')
      await addFileToBundle(fileInfo.path, value)
      setButtonState(key, 'idle')
      setSelectValue("")
      setIsFadingOut(true)
      setTimeout(() => {
        setSelectLoading(false)
        onRemove(fileInfo.path)
      }, 300)
    }
  }

  const handleAddToBundle = async (bundleName: string) => {
    const key = `add-${bundleName}-${fileInfo.path}`
    setButtonState(key, 'loading')
    await addFileToBundle(fileInfo.path, bundleName)
    setButtonState(key, 'idle')
    fadeAndRemove()
  }

  const handleCreateBundle = async () => {
    if (!newBundleName.trim()) return
    if (bundles.some(b => b.name === newBundleName.trim())) {
      alert('Bundle already exists!')
      return
    }
    setCreating(true)
    await addFileToBundle(fileInfo.path, newBundleName.trim())
    setCreating(false)
    setDialogOpen(false)
    setNewBundleName("")
    fadeAndRemove()
  }

  const handleIgnore = async () => {
    setButtonState(`ignore-${fileInfo.path}`, 'loading')
    await fetch('http://localhost:3333/api/hidden-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle',
        filePath: fileInfo.path,
        forceHide: true
      })
    })
    setButtonState(`ignore-${fileInfo.path}`, 'idle')
    fadeAndRemove()
  }

  const fadeAndRemove = () => {
    setIsFadingOut(true)
    setTimeout(() => onRemove(fileInfo.path), 300)
  }

  const openInEditor = async (filePath: string) => {
    try {
      const response = await fetch('http://localhost:3333/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open file');
      }
      toast.success(`Opening ${filePath} in editor...`);
    } catch (err) {
      console.error('Failed to open in editor:', err);
      toast.error(`Could not open file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  const fileName = fileInfo.path.split('/').pop() || fileInfo.path
  const filePath = fileInfo.path.substring(0, fileInfo.path.lastIndexOf('/') + 1)

  return (
    <div className={`flex items-center gap-2 py-0.5 px-1 rounded-sm group cursor-default transition-all duration-300 border border-warning/20 bg-warning/5 hover:bg-warning/10 ${isFadingOut ? 'opacity-0 h-0 overflow-hidden p-0 m-0' : ''}`}>
      {/* File Info Section */}
      <div className="flex items-center gap-1.5 flex-1">
        <div className="flex-shrink-0">
          <File className={getFileIconConfig(fileInfo.path).className} />
        </div>
        <div
          className="flex items-center gap-1.5 min-w-0 cursor-pointer group/file-link flex-1"
          onClick={() => openInEditor(fileInfo.path)}
          title={`Open ${fileInfo.path} in editor`}
        >
          <span className="text-xs text-muted-foreground font-thin group-hover/file-link:text-foreground/70 transition-colors duration-200">{filePath}</span>
          <span className="text-xs text-foreground font-medium group-hover/file-link:text-primary transition-colors duration-200">{fileName}</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover/file-link:opacity-100 transition-opacity duration-200 flex-shrink-0" />
        </div>
      </div>

      {/* Metadata Section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {formatFileSize(fileSizes[fileInfo.path] || 0)}
        </span>
        
        {/* Suggestions */}
        {loading ? (
          <div className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        ) : suggestions.length > 0 && (
          <div className="flex gap-1">
            {suggestions.slice(0, 2).map((bundle) => {
              const key = `add-${bundle}-${fileInfo.path}`
              const isLoading = loadingButtons.has(key)
              return (
                <Badge 
                  key={`suggestion-${bundle}`} 
                  variant="outline" 
                  className="text-xs font-thin h-4 px-1.5 bg-primary/10 cursor-pointer hover:bg-primary/20 transition-colors duration-200 flex items-center gap-1"
                  onClick={() => handleAddToBundle(bundle)}
                  title={`Add to ${bundle} bundle`}
                >
                  {isLoading ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Plus className="w-2.5 h-2.5" />
                  )}
                  {bundle}
                </Badge>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1 items-center">
          {/* More options dropdown */}
          <Select value={selectValue} onValueChange={handleSelect} disabled={isFadingOut || selectLoading}>
            <SelectTrigger className="h-4 w-4 p-0 border-0 bg-transparent hover:bg-muted/50 opacity-60 hover:opacity-100 transition-all duration-200 [&>svg]:hidden">
              {selectLoading ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <span className="text-xs">⋯</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {availableBundles.map(name => (
                <SelectItem key={name} value={name} className="text-xs">
                  <div className="flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    Add to {name}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="__create__" className="text-xs italic text-muted-foreground">
                + Create new bundle…
              </SelectItem>
              <SelectItem value="__ignore__" className="text-xs text-muted-foreground">
                Ignore file
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dialog for creating a new bundle */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Create New Bundle</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Bundle name"
            value={newBundleName}
            onChange={e => setNewBundleName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateBundle() }}
            className="mt-2"
            disabled={creating || loadingButtons.has(`add-${newBundleName}-${fileInfo.path}`)}
          />
          <DialogFooter>
            <Button onClick={handleCreateBundle} disabled={creating || !newBundleName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 
