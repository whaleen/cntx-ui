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
      className={`cursor-pointer transition-all border-vesper bg-vesper-card hover:border-vesper-accent ${
        isSelected ? 'ring-1 ring-primary border-primary' : ''
      }`}
      onClick={() => onSelect(bundle.name)}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              {isSmart ? <Zap className="w-3 h-3 text-vesper-accent" /> : <Box className="w-3 h-3 text-muted-foreground" />}
              <h3 className="text-sm font-thin truncate color-vesper-fg">{displayName}</h3>
            </div>
            <Badge variant="outline" className="text-[10px] font-thin uppercase tracking-tighter border-vesper color-vesper-muted px-1 h-4">
              {isSmart ? 'Smart' : 'Manual'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${bundle.changed ? 'bg-vesper-warning animate-pulse' : 'bg-vesper-success'}`} />
            <span className="text-[10px] font-thin uppercase tracking-widest color-vesper-muted">
              {bundle.changed ? 'Syncing' : 'In Context'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center justify-between text-[11px] font-thin color-vesper-muted">
            <div className="flex items-center gap-1">
              <Fingerprint className="w-3 h-3" />
              <span>{bundle.fileCount} units</span>
            </div>
            <span>{formatFileSize(bundle.size)}</span>
          </div>
          
          {bundle.generated && (
            <div className="flex items-center gap-1 text-[9px] font-thin color-vesper-muted mt-2 opacity-50">
              <Clock className="w-2.5 h-2.5" />
              <span>Synced {new Date(bundle.generated).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default BundleCard
