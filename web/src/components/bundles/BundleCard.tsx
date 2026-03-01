import React from 'react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { CheckCircle, Clock, Box, Zap, Fingerprint } from 'lucide-react'
import { formatFileSize } from './utils'

interface BundleCardProps {
  bundle: any
  isSelected: boolean
  onSelect: (bundleName: string) => void
  lastRefresh?: Date
}

const BundleCard: React.FC<BundleCardProps> = ({
  bundle,
  isSelected,
  onSelect,
}) => {
  const isSmart = bundle.name.startsWith('smart:')
  const displayName = isSmart ? bundle.name.replace('smart:', '') : bundle.name

  return (
    <Card
      className={`cursor-pointer transition-all border-border bg-card hover:border-border-accent min-h-[160px] flex flex-col ${
        isSelected ? 'ring-1 ring-primary border-primary' : ''
      }`}
      onClick={() => onSelect(bundle.name)}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
              {isSmart ? <Zap className="w-3 h-3 text-primary" /> : <Box className="w-3 h-3 text-muted-foreground" />}
              <h3 className="text-sm truncate text-foreground">{displayName}</h3>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-tighter border-border text-muted-foreground px-1 h-4 shrink-0 flex-shrink-0">
              {isSmart ? 'Smart' : 'Manual'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${bundle.changed ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {bundle.changed ? 'Syncing' : 'In Context'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col justify-between">
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center justify-between text-[11px]  text-muted-foreground">
            <div className="flex items-center gap-1">
              <Fingerprint className="w-3 h-3" />
              <span>{bundle.fileCount} {bundle.fileCount === 1 ? 'unit' : 'units'}</span>
            </div>
            <span>{formatFileSize(bundle.size)}</span>
          </div>
          
          {bundle.generated ? (
            <div className="flex items-center gap-1 text-[9px]  text-muted-foreground mt-2 opacity-50">
              <Clock className="w-2.5 h-2.5" />
              <span>Synced {new Date(bundle.generated).toLocaleTimeString()}</span>
            </div>
          ) : (
            <div className="h-5" /> /* Reserved space for alignment */
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default BundleCard
