import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Input } from '../ui/input'
import { Loader2 } from 'lucide-react'
import type { UndercategorizedFileRowProps } from './types'
import { useBundleSuggestions, formatFileSize } from './utils'

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

  return (
    <div className={`flex items-center gap-2 p-3 rounded border border-warning/20 bg-background transition-all duration-300 ${isFadingOut ? 'opacity-0 h-0 overflow-hidden p-0 m-0' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-foreground truncate">
          {fileInfo.path}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            Currently in: {currentBundleText === 'master' ? 'master only' : currentBundleText}
          </span>
          <span className="text-xs text-muted-foreground">
            • {formatFileSize(fileSizes[fileInfo.path] || 0)}
          </span>
          {loading ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Loading suggestions...</span>
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          ) : suggestions.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Suggested:</span>
              {suggestions.slice(0, 2).map((bundle) => (
                <Badge key={`suggestion-${bundle}`} variant="outline" className="text-xs px-1 py-0">
                  {bundle}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleIgnore}
          className="h-6 px-2 text-xs border-muted hover:bg-muted"
          disabled={isFadingOut || loadingButtons.has(`ignore-${fileInfo.path}`)}
        >
          Ignore
        </Button>
        {(suggestions.length > 0 ? suggestions.slice(0, 2) : bundles.filter(b => b.name !== 'master').map(b => b.name).slice(0, 2)).map((bundleName) => {
          const key = `add-${bundleName}-${fileInfo.path}`
          const isLoading = loadingButtons.has(key)
          return (
            <Button
              key={`action-${bundleName}`}
              variant="outline"
              size="sm"
              onClick={() => handleAddToBundle(bundleName)}
              className="h-6 px-2 text-xs"
              disabled={isFadingOut || isLoading}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : `Add to ${bundleName}`}
            </Button>
          )
        })}
        {/* Select for all bundles + create new */}
        <Select value={selectValue} onValueChange={handleSelect} disabled={isFadingOut || selectLoading}>
          <SelectTrigger className="h-6 px-2 text-xs w-28 border-muted">
            {selectLoading ? (
              <Loader2 className="w-3 h-3 animate-spin mx-auto" />
            ) : (
              <SelectValue placeholder="More…" />
            )}
          </SelectTrigger>
          <SelectContent>
            {availableBundles.map(name => (
              <SelectItem key={name} value={name} className="text-xs">
                Add to {name}
              </SelectItem>
            ))}
            <SelectItem value="__create__" className="text-xs italic text-muted-foreground">
              + Create new bundle…
            </SelectItem>
          </SelectContent>
        </Select>
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
    </div>
  )
} 
