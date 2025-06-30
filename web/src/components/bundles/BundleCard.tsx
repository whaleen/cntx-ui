import React from 'react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Copy, RefreshCw, Loader2, CheckCircle, AlertCircle, Download, AlertTriangle, Clock, Box } from 'lucide-react'
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
  lastRefresh?: Date // When was data last fetched
}

type BundleHealthStatus = 'healthy' | 'warning' | 'error' | 'stale'

const getBundleHealth = (bundle: any, lastRefresh?: Date): BundleHealthStatus => {
  // If bundle shows as changed, check how long it's been that way
  if (bundle.changed) {
    if (!lastRefresh) return 'warning'

    const now = new Date()
    const timeSinceRefresh = now.getTime() - lastRefresh.getTime()
    const minutesSinceRefresh = timeSinceRefresh / (1000 * 60)

    // If it's been "changed" for more than 5 minutes after a refresh, something's wrong
    if (minutesSinceRefresh > 5) return 'error'

    // If it's been changed for more than 1 minute, show warning
    if (minutesSinceRefresh > 1) return 'warning'

    return 'warning' // Just changed
  }

  // If not changed but no recent refresh data, might be stale
  if (!lastRefresh) return 'stale'

  const now = new Date()
  const timeSinceRefresh = now.getTime() - lastRefresh.getTime()
  const minutesSinceRefresh = timeSinceRefresh / (1000 * 60)

  // If no refresh in 10+ minutes, data might be stale
  if (minutesSinceRefresh > 10) return 'stale'

  return 'healthy'
}

const getBundleStatusInfo = (health: BundleHealthStatus, bundle: any) => {
  switch (health) {
    case 'healthy':
      return {
        label: 'SYNCED',
        variant: 'secondary' as const,
        icon: CheckCircle,
        className: 'text-[color:var(--color-success)]'
      }
    case 'warning':
      return {
        label: bundle.changed ? 'SYNCING' : 'SYNCED',
        variant: 'outline' as const,
        icon: Clock,
        className: 'text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30'
      }
    case 'error':
      return {
        label: 'SYNC FAILED',
        variant: 'destructive' as const,
        icon: AlertCircle,
        className: ''
      }
    case 'stale':
      return {
        label: 'STALE',
        variant: 'outline' as const,
        icon: AlertTriangle,
        className: 'text-muted-foreground border-muted-foreground/30'
      }
  }
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
  hasUnassignedFiles,
  lastRefresh
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

  // Get bundle health status
  const health = getBundleHealth(bundle, lastRefresh)
  const statusInfo = getBundleStatusInfo(health, bundle)
  const StatusIcon = statusInfo.icon

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${bundle.changed ? 'border-warning' : ''
        } ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
      onClick={() => onSelect(bundle.name)}
    >
      <CardHeader className="pb-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4" />
            <h3 className="text-sm font-thin truncate">{bundle.name}</h3>
          </div>
          <Badge
            variant={statusInfo.variant}
            className={`text-xs font-thin h-4 w-fit flex items-center gap-1 ${statusInfo.className}`}
            title={health === 'error' ? 'Bundle has been changed for >5min - sync may be failing' :
              health === 'warning' ? 'Bundle is syncing or recently changed' :
                health === 'stale' ? 'Data may be stale - no recent refresh' :
                  'Bundle is healthy and synced'}
          >
            <StatusIcon className="w-2.5 h-2.5" />
            {statusInfo.label}
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
