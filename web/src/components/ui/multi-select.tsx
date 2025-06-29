import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Option {
  label: string
  value: string
  color?: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onSelectedChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onSelectedChange,
  placeholder = "Select items...",
  className
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onSelectedChange(selected.filter(item => item !== value))
    } else {
      onSelectedChange([...selected, value])
    }
  }

  const handleRemove = (value: string) => {
    onSelectedChange(selected.filter(item => item !== value))
  }

  const handleClear = () => {
    onSelectedChange([])
  }

  const selectedOptions = options.filter(option => selected.includes(option.value))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-8 px-2 py-1 text-sm", className)}
        >
          <div className="flex items-center gap-1 flex-1 overflow-hidden">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-nowrap">
                  {selectedOptions.map((option) => (
                    <Badge
                      key={option.value}
                      variant="secondary"
                      className="flex-shrink-0 whitespace-nowrap px-1 py-0.5 text-xs"
                      style={option.color ? {
                        backgroundColor: option.color + '20',
                        borderColor: option.color,
                        color: option.color
                      } : undefined}
                    >
                      {option.label}
                      <button
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleRemove(option.value)
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={() => handleRemove(option.value)}
                      >
                        <X className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." className="h-8 text-sm" />
          <CommandEmpty>No options found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
                className="text-sm"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.includes(option.value) ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex items-center gap-2 flex-1">
                  {option.color && (
                    <div
                      className="w-3 h-3 rounded-full border border-border/50"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span>{option.label}</span>
                </div>
              </CommandItem>
            ))}
            {selected.length > 0 && (
              <CommandItem
                onSelect={handleClear}
                className="justify-center text-center text-muted-foreground"
              >
                Clear all selections
              </CommandItem>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
