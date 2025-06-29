// Shared types for bundle components
// Updated: 2025-01-28 - Added BundleLegendProps

export interface Bundle {
  name: string
  changed: boolean
  fileCount: number
  content: string
  files: string[]
  lastGenerated: string
  size: number
}

export interface FileInfo {
  path: string
  bundles: string[]
}

export interface ButtonState {
  loading: Set<string>
  success: Set<string>
  error: Set<string>
}

export interface BundleDetailViewProps {
  bundle: Bundle
  bundles: Bundle[]
  selectedBundleName: string
  editingBundles: Set<string>
  availableFiles: string[]
  loadingButtons: Set<string>
  toggleEditMode: (bundleName: string) => void
  removeFileFromBundle: (fileName: string, bundleName: string) => void
  addFileToBundle: (fileName: string, bundleName: string) => void
  addFilesToBundle: (fileNames: string[], bundleName: string) => void
  removeFilesFromBundle: (fileNames: string[], bundleName: string) => void
  getFileBundles: (filePath: string) => string[]
  fileSizes: Record<string, number>
}

export interface BundleCardProps {
  bundle: Bundle
  isSelected: boolean
  onSelect: (bundleName: string) => void
  onRegenerate: (bundleName: string) => void
  onCopy: (bundleName: string) => void
  onDownload: (bundleName: string) => void
  loadingButtons: Set<string>
  successButtons: Set<string>
  errorButtons: Set<string>
  hasUnassignedFiles: boolean
}

export interface FileAnalysisProps {
  undercategorizedFiles: FileInfo[]
  bundles: Bundle[]
  addFileToBundle: (filePath: string, bundleName: string) => void
  loadFileAnalysis: () => void
  loadingButtons: Set<string>
  setButtonState: (
    key: string,
    state: 'loading' | 'success' | 'error' | 'idle'
  ) => void
  onRemoveFile: (filePath: string) => void
  fileSizes: Record<string, number>
}

export interface UndercategorizedFileRowProps {
  fileInfo: FileInfo
  bundles: Bundle[]
  addFileToBundle: (filePath: string, bundleName: string) => void
  loadFileAnalysis: () => void
  loadingButtons: Set<string>
  setButtonState: (
    key: string,
    state: 'loading' | 'success' | 'error' | 'idle'
  ) => void
  onRemove: (filePath: string) => void
  fileSizes: Record<string, number>
}

export interface BundleLegendProps {
  undercategorizedFilesCount: number
}
