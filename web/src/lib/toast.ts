import { toast as baseToast } from "@/hooks/use-toast"

export const toast = {
  success: (message: string, description?: string) => {
    return baseToast({
      variant: "success",
      title: message,
      description,
    })
  },
  error: (message: string, description?: string) => {
    return baseToast({
      variant: "destructive",
      title: message,
      description,
    })
  },
  info: (message: string, description?: string) => {
    return baseToast({
      variant: "info",
      title: message,
      description,
    })
  },
  warning: (message: string, description?: string) => {
    return baseToast({
      variant: "warning", 
      title: message,
      description,
    })
  },
}