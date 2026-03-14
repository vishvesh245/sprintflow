"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined)

const useTooltip = () => {
  const context = React.useContext(TooltipContext)
  if (!context) {
    throw new Error("useTooltip must be used within Tooltip")
  }
  return context
}

const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const Tooltip = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </TooltipContext.Provider>
  )
}

const TooltipTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onMouseEnter, onMouseLeave, ...props }, ref) => {
    const { setOpen } = useTooltip()
    return (
      <button
        ref={ref}
        onMouseEnter={(e) => {
          setOpen(true)
          onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          setOpen(false)
          onMouseLeave?.(e)
        }}
        {...props}
      />
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open } = useTooltip()

    if (!open) return null

    return (
      <div
        className={cn(
          "absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-md whitespace-nowrap",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
