import React from 'react'
import { Badge } from '../ui/badge'
import { AlertTriangle } from 'lucide-react'
import type { BundleLegendProps } from './types'

const BundleLegend: React.FC<BundleLegendProps> = ({ undercategorizedFilesCount }) => {
  return (
    <div className="flex items-center gap-4">
      {undercategorizedFilesCount > 0 && (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {undercategorizedFilesCount} files need better bundle assignment
        </Badge>
      )}
    </div>
  )
}

export default BundleLegend 
