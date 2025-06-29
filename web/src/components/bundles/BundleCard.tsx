import React from 'react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Copy, RefreshCw, Loader2, CheckCircle, AlertCircle, Download, AlertTriangle } from 'lucide-react'
import { formatFileSize } from './utils'

// Temporary local interface to test
interface BundleCardProps {
  bundle: any
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

const BundleCard: React.FC<BundleCardProps> = ({
  bundle,
  isSelected,
  onSelect,
  onRegenerate,
  onCopy,
  onDownload,
  loadingButtons,
  successButtons,
  errorButtons,
  hasUnassignedFiles
}) => {
  const copyKey = `copy-${bundle.name}`
  const downloadKey = `download-${bundle.name}`
  const regenKey = `regen-${bundle.name}`
  const isCopyLoading = loadingButtons.has(copyKey)
  const isDownloadLoading = loadingButtons.has(downloadKey)
  const isRegenLoading = loadingButtons.has(regenKey)
  const isCopySuccess = successButtons.has(copyKey)
  const isDownloadSuccess = successButtons.has(downloadKey)
  const isRegenSuccess = successButtons.has(regenKey)
  const isCopyError = errorButtons.has(copyKey)
  const isDownloadError = errorButtons.has(downloadKey)
  const isRegenError = errorButtons.has(regenKey)

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${bundle.changed ? 'border-warning' : ''
        } ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
      onClick={() => onSelect(bundle.name)}
    >
      <CardHeader className="pb-2">
        <div className="space-y-1.5">
          <h3 className="text-sm font-thin truncate">{bundle.name}</h3>
          <Badge variant={bundle.changed ? 'destructive' : 'secondary'} className="text-xs font-thin h-4 w-fit">
            {bundle.changed ? 'CHANGED' : 'SYNCED'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
              <span>{bundle.fileCount} files</span>
              <span>•</span>
              <span>{formatFileSize(bundle.size)}</span>
              {hasUnassignedFiles && (
                <>
                  <span>•</span>
                  <span className="text-warning text-xs">
                    <AlertTriangle className="w-2.5 h-2.5 inline mr-1" />
                    Files need assignment
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex" onClick={(e) => e.stopPropagation()}>
            <div className="inline-flex rounded-md border border-input bg-background shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRegenerate(bundle.name)}
                disabled={isRegenLoading}
                className="h-6 px-1.5 rounded-none border-r border-input first:rounded-l-md last:rounded-r-md hover:bg-accent"
              >
                {isRegenLoading ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : isRegenSuccess ? (
                  <CheckCircle className="w-2.5 h-2.5" />
                ) : isRegenError ? (
                  <AlertCircle className="w-2.5 h-2.5" />
                ) : (
                  <RefreshCw className="w-2.5 h-2.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(bundle.name)}
                disabled={isCopyLoading}
                className="h-6 px-1.5 rounded-none border-r border-input first:rounded-l-md last:rounded-r-md hover:bg-accent"
              >
                {isCopyLoading ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : isCopySuccess ? (
                  <CheckCircle className="w-2.5 h-2.5" />
                ) : isCopyError ? (
                  <AlertCircle className="w-2.5 h-2.5" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDownload(bundle.name)}
                disabled={isDownloadLoading}
                className="h-6 px-1.5 rounded-none first:rounded-l-md last:rounded-r-md hover:bg-accent"
              >
                {isDownloadLoading ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : isDownloadSuccess ? (
                  <CheckCircle className="w-2.5 h-2.5" />
                ) : isDownloadError ? (
                  <AlertCircle className="w-2.5 h-2.5" />
                ) : (
                  <Download className="w-2.5 h-2.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default BundleCard 
