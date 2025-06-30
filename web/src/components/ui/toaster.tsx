import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastIcon,
  formatToastText,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3">
              <ToastIcon variant={variant} />
              <div className="grid gap-1 flex-1">
                {title && (
                  <ToastTitle dangerouslySetInnerHTML={formatToastText(String(title), variant)} />
                )}
                {description && (
                  <ToastDescription dangerouslySetInnerHTML={formatToastText(String(description), variant)} />
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}