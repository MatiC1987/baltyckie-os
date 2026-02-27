import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, AlertTriangle, Info } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isDestructive = props.variant === "destructive"
        const IconComponent = isDestructive ? AlertTriangle : CheckCircle2

        return (
          <Toast key={id} {...props}>
            <div className="flex items-start gap-3">
              <IconComponent
                className={`h-5 w-5 shrink-0 mt-0.5 ${
                  isDestructive
                    ? "text-destructive-foreground"
                    : "text-emerald-500"
                }`}
                data-testid="toast-icon"
              />
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
            <div
              className={`toast-progress ${isDestructive ? "toast-progress-destructive" : ""}`}
              data-testid="toast-progress"
            />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
