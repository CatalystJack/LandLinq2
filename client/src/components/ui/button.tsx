import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold uppercase tracking-wider transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-2 border-[#4A90E2] hover:border-[#4A90E2] rounded-md shadow-md",
        white: "bg-white text-[#081729] hover:bg-[#f8f9fa] border-2 border-white hover:border-[#e9ecef] rounded-md shadow-md",
        destructive: "bg-red-600 text-white hover:bg-red-700 rounded-md shadow-md",
        outline: "border-2 border-[#4A90E2] bg-transparent text-[#4A90E2] hover:bg-[#4A90E2] hover:text-white rounded-md shadow-sm",
        secondary: "bg-[#081729] text-white hover:bg-white hover:text-[#081729] border-2 border-[#081729] hover:border-[#081729] rounded-md shadow-md",
        ghost: "text-[#081729] hover:bg-gray-100 rounded-md",
        link: "text-[#4A90E2] underline-offset-4 hover:underline font-medium normal-case tracking-normal",
      },
      size: {
        default: "h-10 px-6 py-3 text-sm",
        sm: "h-8 px-4 py-2 text-xs",
        lg: "h-12 px-8 py-4 text-base",
        icon: "h-10 w-10 p-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
