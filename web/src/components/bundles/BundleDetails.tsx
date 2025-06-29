import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Edit3, Plus, Minus, Search, Loader2, File } from 'lucide-react'
import type { BundleDetailViewProps } from './types'
import { formatFileSize, getFileIconConfig } from './utils'

const BundleDetails: React.FC<BundleDetailViewProps> = ({
  bundle,
  bundles,
  selectedBundleName,
  editingBundles,
  availableFiles,
  loadingButtons,
  toggleEditMode,
  removeFileFromBundle,
  addFileToBundle,
  addFilesToBundle,
  removeFilesFromBundle,
  getFileBundles,
  fileSizes
}) => {
  // Get the most current bundle from bundles array to ensure we have latest file updates
  const currentBundle = bundles?.find((b) => b.name === selectedBundleName) || bundle

  // Add local search state for this component
  const [localSearch, setLocalSearch] = useState('')
  // Keyboard navigation state
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const availableFilesListRef = useRef<HTMLDivElement>(null)

  // Bundle files search state
  const [bundleFilesSearch, setBundleFilesSearch] = useState('')
  const [bundleFilesSearchFocused, setBundleFilesSearchFocused] = useState(false)
  const [bundleFilesHighlightedIdx, setBundleFilesHighlightedIdx] = useState<number>(-1)
  const bundleFilesSearchRef = useRef<HTMLInputElement>(null)
  const bundleFilesListRef = useRef<HTMLDivElement>(null)

  // Range selection state for available files
  const [selectionStart, setSelectionStart] = useState<number>(-1)
  const [selectionEnd, setSelectionEnd] = useState<number>(-1)

  // Range selection state for bundle files
  const [bundleSelectionStart, setBundleSelectionStart] = useState<number>(-1)
  const [bundleSelectionEnd, setBundleSelectionEnd] = useState<number>(-1)

  // Use local search state instead of the passed props
  const searchValue = localSearch
  const setSearchValue = setLocalSearch

  // Debug logging
  console.log('BundleDetails state:', {
    currentBundleName: currentBundle.name,
    isEditing: editingBundles.has(currentBundle.name),
    availableFilesCount: availableFiles.length,
    editingBundles: Array.from(editingBundles)
  })

  // Compute filtered files for available files section
  // Available files are files that are NOT in the current bundle
  const filteredFiles = availableFiles
    .filter(file => !currentBundle.files.includes(file)) // Only show files not in current bundle
    .filter(file => searchValue === '' || file.toLowerCase().includes(searchValue.toLowerCase()))

  // Compute filtered files for bundle files section
  const filteredBundleFiles = currentBundle.files
    .filter(file => bundleFilesSearch === '' || file.toLowerCase().includes(bundleFilesSearch.toLowerCase()))

  // Reset highlight when search/filter changes or focus changes
  useEffect(() => {
    if (!searchFocused) {
      setHighlightedIdx(-1)
    }
  }, [searchValue, availableFiles, currentBundle.files, searchFocused])

  // Reset bundle files highlight when search/filter changes or focus changes
  useEffect(() => {
    if (!bundleFilesSearchFocused) {
      setBundleFilesHighlightedIdx(-1)
    }
  }, [bundleFilesSearch, currentBundle.files, bundleFilesSearchFocused])

  // Auto-scroll highlighted items into view for available files
  useEffect(() => {
    if (highlightedIdx >= 0 && availableFilesListRef.current) {
      const highlightedElement = availableFilesListRef.current.children[highlightedIdx] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [highlightedIdx])

  // Auto-scroll highlighted items into view for bundle files
  useEffect(() => {
    if (bundleFilesHighlightedIdx >= 0 && bundleFilesListRef.current) {
      const highlightedElement = bundleFilesListRef.current.children[bundleFilesHighlightedIdx] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [bundleFilesHighlightedIdx])

  // Keyboard navigation handler for available files
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchFocused || filteredFiles.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (e.shiftKey) {
        // Shift+Down: extend selection
        if (selectionStart === -1) {
          setSelectionStart(highlightedIdx >= 0 ? highlightedIdx : 0)
        }
        const newEnd = Math.min(highlightedIdx + 1, filteredFiles.length - 1)
        setHighlightedIdx(newEnd)
        setSelectionEnd(newEnd)
      } else {
        // Normal Down: clear selection and move highlight
        setSelectionStart(-1)
        setSelectionEnd(-1)
        setHighlightedIdx(idx => Math.min(idx + 1, filteredFiles.length - 1))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (e.shiftKey) {
        // Shift+Up: extend selection
        if (selectionStart === -1) {
          setSelectionStart(highlightedIdx >= 0 ? highlightedIdx : 0)
        }
        const newEnd = Math.max(highlightedIdx - 1, 0)
        setHighlightedIdx(newEnd)
        setSelectionEnd(newEnd)
      } else {
        // Normal Up: clear selection and move highlight
        setSelectionStart(-1)
        setSelectionEnd(-1)
        if (highlightedIdx <= 0) {
          // If at top or no highlight, remove highlight
          setHighlightedIdx(-1)
        } else {
          setHighlightedIdx(idx => idx - 1)
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectionStart !== -1 && selectionEnd !== -1) {
        // Add all files in selection range
        const start = Math.min(selectionStart, selectionEnd)
        const end = Math.max(selectionStart, selectionEnd)
        const selectedFiles = []
        for (let i = start; i <= end; i++) {
          if (i < filteredFiles.length) {
            selectedFiles.push(filteredFiles[i])
          }
        }
        addFilesToBundle(selectedFiles, currentBundle.name)
        setSelectionStart(-1)
        setSelectionEnd(-1)
        setHighlightedIdx(-1)
      } else if (highlightedIdx >= 0 && highlightedIdx < filteredFiles.length) {
        const file = filteredFiles[highlightedIdx]
        addFileToBundle(file, currentBundle.name)
        // Clear highlight but keep focus for continued navigation
        setHighlightedIdx(-1)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSearchValue('')
      setHighlightedIdx(-1)
      setSelectionStart(-1)
      setSelectionEnd(-1)
      searchInputRef.current?.blur()
    }
  }

  // Keyboard navigation handler for bundle files
  const handleBundleFilesSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!bundleFilesSearchFocused || filteredBundleFiles.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (e.shiftKey) {
        // Shift+Down: extend selection
        if (bundleSelectionStart === -1) {
          setBundleSelectionStart(bundleFilesHighlightedIdx >= 0 ? bundleFilesHighlightedIdx : 0)
        }
        const newEnd = Math.min(bundleFilesHighlightedIdx + 1, filteredBundleFiles.length - 1)
        setBundleFilesHighlightedIdx(newEnd)
        setBundleSelectionEnd(newEnd)
      } else {
        // Normal Down: clear selection and move highlight
        setBundleSelectionStart(-1)
        setBundleSelectionEnd(-1)
        setBundleFilesHighlightedIdx(idx => Math.min(idx + 1, filteredBundleFiles.length - 1))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (e.shiftKey) {
        // Shift+Up: extend selection
        if (bundleSelectionStart === -1) {
          setBundleSelectionStart(bundleFilesHighlightedIdx >= 0 ? bundleFilesHighlightedIdx : 0)
        }
        const newEnd = Math.max(bundleFilesHighlightedIdx - 1, 0)
        setBundleFilesHighlightedIdx(newEnd)
        setBundleSelectionEnd(newEnd)
      } else {
        // Normal Up: clear selection and move highlight
        setBundleSelectionStart(-1)
        setBundleSelectionEnd(-1)
        if (bundleFilesHighlightedIdx <= 0) {
          // If at top or no highlight, remove highlight
          setBundleFilesHighlightedIdx(-1)
        } else {
          setBundleFilesHighlightedIdx(idx => idx - 1)
        }
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      if (bundleSelectionStart !== -1 && bundleSelectionEnd !== -1) {
        // Remove all files in selection range
        const start = Math.min(bundleSelectionStart, bundleSelectionEnd)
        const end = Math.max(bundleSelectionStart, bundleSelectionEnd)
        const selectedFiles = []
        for (let i = start; i <= end; i++) {
          if (i < filteredBundleFiles.length) {
            selectedFiles.push(filteredBundleFiles[i])
          }
        }
        removeFilesFromBundle(selectedFiles, currentBundle.name)
        setBundleSelectionStart(-1)
        setBundleSelectionEnd(-1)
        setBundleFilesHighlightedIdx(-1)
      } else if (bundleFilesHighlightedIdx >= 0 && bundleFilesHighlightedIdx < filteredBundleFiles.length) {
        const file = filteredBundleFiles[bundleFilesHighlightedIdx]
        removeFileFromBundle(file, currentBundle.name)
        // Clear highlight but keep focus for continued navigation
        setBundleFilesHighlightedIdx(-1)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setBundleFilesSearch('')
      setBundleFilesHighlightedIdx(-1)
      setBundleSelectionStart(-1)
      setBundleSelectionEnd(-1)
      bundleFilesSearchRef.current?.blur()
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-thin">{currentBundle.name}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{currentBundle.fileCount} files</span>
              <span>•</span>
              <span>{formatFileSize(currentBundle.size)}</span>
              {currentBundle.lastGenerated && (
                <>
                  <span>•</span>
                  <span>Last generated: {new Date(currentBundle.lastGenerated).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleEditMode(currentBundle.name)}
            className="h-8 px-3"
          >
            <Edit3 className="w-3 h-3 mr-1" />
            {editingBundles.has(currentBundle.name) ? 'Done' : 'Edit'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Bundle Files Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-thin h-5">
                Bundle Files
              </Badge>
              <span className="text-xs text-muted-foreground">
                {editingBundles.has(currentBundle.name) ? '(Click - to remove from bundle)' : ''}
              </span>
            </div>

            {editingBundles.has(currentBundle.name) && (
              <div className="mb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3" />
                  <input
                    ref={bundleFilesSearchRef}
                    type="text"
                    placeholder="Search bundle files..."
                    value={bundleFilesSearch}
                    onChange={(e) => setBundleFilesSearch(e.target.value)}
                    onKeyDown={handleBundleFilesSearchKeyDown}
                    onFocus={() => setBundleFilesSearchFocused(true)}
                    onBlur={() => setBundleFilesSearchFocused(false)}
                    className="w-full pl-7 pr-3 py-1 text-xs border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {bundleFilesSearch && (
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                    <span>Press <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">Delete</kbd> to remove, <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">↑</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded border text-xs">↓</kbd> to navigate, <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">Shift+↑/↓</kbd> to select range, <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">Esc</kbd> to exit</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1 max-h-40 overflow-y-auto" ref={bundleFilesListRef} onMouseLeave={() => setBundleFilesHighlightedIdx(-1)}>
              {(() => {
                if (filteredBundleFiles.length === 0) {
                  return (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-xs">
                        {bundleFilesSearch ? 'No files match your search' : 'No files in this bundle'}
                      </p>
                    </div>
                  )
                }
                return filteredBundleFiles.map((file, idx) => {
                  const removeKey = `remove-${currentBundle.name}-${file}`
                  const isLoading = loadingButtons.has(removeKey)
                  const fileBundles = getFileBundles(file)
                  const fileName = file.split('/').pop() || file
                  const filePath = file.substring(0, file.lastIndexOf('/') + 1)
                  const isHighlighted = bundleFilesSearchFocused && idx === bundleFilesHighlightedIdx
                  const isSelected = bundleSelectionStart !== -1 && bundleSelectionEnd !== -1 &&
                    idx >= Math.min(bundleSelectionStart, bundleSelectionEnd) &&
                    idx <= Math.max(bundleSelectionStart, bundleSelectionEnd)
                  return (
                    <div
                      key={file}
                      className={`bundle-file-row flex items-center gap-2 py-0.5 px-1 rounded-sm group cursor-pointer ${isSelected ? 'bg-destructive/20 ring-1 ring-destructive' :
                        isHighlighted ? 'bg-destructive/10 ring-2 ring-destructive' :
                          'hover:bg-muted/50'
                        }`}
                      onMouseEnter={() => setBundleFilesHighlightedIdx(idx)}
                      tabIndex={-1}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFileFromBundle(file, currentBundle.name)}
                        disabled={isLoading}
                        className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 flex-shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <Minus className="w-2.5 h-2.5 text-destructive" />
                        )}
                      </Button>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <File className={getFileIconConfig(file).className} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground font-thin">{filePath}</span>
                          <span className="text-xs text-foreground font-medium">{fileName}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(fileSizes[file] || 0)}
                          </span>
                          {fileBundles.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {fileBundles.map(bundleName => (
                                <Badge key={bundleName} variant="outline" className="text-xs font-thin h-4 px-1.5">
                                  {bundleName}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Available Files Section (Edit Mode Only) */}
          {editingBundles.has(currentBundle.name) && (
            <div className="space-y-2 mt-4 pt-3 border-t">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-thin h-5">
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
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search files..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className="w-full pl-7 pr-3 py-1 text-xs border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {searchValue && (
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                    <span>Press <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">Enter</kbd> to add, <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">↑</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded border text-xs">↓</kbd> to navigate, <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">Shift+↑/↓</kbd> to select range, <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">Esc</kbd> to exit</span>
                  </div>
                )}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto" ref={availableFilesListRef} onMouseLeave={() => setHighlightedIdx(-1)}>
                {(() => {
                  if (filteredFiles.length === 0) {
                    return (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-xs">
                          {searchValue ? 'No files match your search' : 'All files are already in this bundle'}
                        </p>
                      </div>
                    )
                  }
                  return filteredFiles.map((file, idx) => {
                    const addKey = `add-${currentBundle.name}-${file}`
                    const isLoading = loadingButtons.has(addKey)
                    const fileBundles = getFileBundles(file)
                    const fileName = file.split('/').pop() || file
                    const filePath = file.substring(0, file.lastIndexOf('/') + 1)
                    const isHighlighted = searchFocused && idx === highlightedIdx
                    const isSelected = selectionStart !== -1 && selectionEnd !== -1 &&
                      idx >= Math.min(selectionStart, selectionEnd) &&
                      idx <= Math.max(selectionStart, selectionEnd)
                    return (
                      <div
                        key={file}
                        className={`available-file-row flex items-center gap-2 py-0.5 px-1 rounded-sm group cursor-pointer ${isSelected ? 'bg-primary/20 ring-1 ring-primary' :
                          isHighlighted ? 'bg-primary/10 ring-2 ring-primary' :
                            'hover:bg-muted/50'
                          }`}
                        onMouseEnter={() => setHighlightedIdx(idx)}
                        tabIndex={-1}
                      >
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
                          <div className="flex-shrink-0">
                            <File className={getFileIconConfig(file).className} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground font-thin">{filePath}</span>
                            <span className="text-xs text-foreground font-medium">{fileName}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(fileSizes[file] || 0)}
                            </span>
                            {fileBundles.length > 0 && (
                              <div className="flex gap-1 flex-wrap ml-auto">
                                {fileBundles.map(bundleName => (
                                  <Badge key={bundleName} variant="outline" className="text-xs font-thin h-4 px-1.5">
                                    {bundleName}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default BundleDetails 
