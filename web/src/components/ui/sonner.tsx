import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--color-success)",
          "--success-text": "var(--color-success-foreground)",
          "--success-border": "var(--color-success)",
          "--error-bg": "var(--destructive)",
          "--error-text": "var(--destructive-foreground)",
          "--error-border": "var(--destructive)",
          "--info-bg": "var(--color-info)",
          "--info-text": "var(--color-info-foreground)",
          "--info-border": "var(--color-info)",
          "--warning-bg": "var(--color-warning)",
          "--warning-text": "var(--color-warning-foreground)",
          "--warning-border": "var(--color-warning)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
