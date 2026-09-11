import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-semibold normal-case tracking-normal transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55C3E9]/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#55C3E9] text-[#081729] border-[#55C3E9] hover:bg-white hover:text-[#3286C8] hover:border-[#55C3E9]",
        brand: "bg-[#55C3E9] text-[#081729] border-[#55C3E9] hover:bg-white hover:text-[#3286C8] hover:border-[#55C3E9]",
        white: "bg-white text-[#081729] border-white hover:bg-[#55C3E9] hover:text-[#081729] hover:border-[#55C3E9]",
        destructive: "bg-red-600 text-white border-red-600 hover:bg-white hover:text-red-600 hover:border-red-600",
        outline: "bg-white text-[#173047] border-[#b8c9d8] hover:bg-[#55C3E9] hover:text-[#081729] hover:border-[#55C3E9]",
        secondary: "bg-[#081729] text-white border-[#081729] hover:bg-white hover:text-[#081729] hover:border-[#081729]",
        ghost: "bg-transparent text-[#081729] border-transparent hover:bg-white hover:text-[#3286C8] hover:border-[#55C3E9]",
        link: "border-transparent bg-transparent text-[#4A90E2] underline-offset-4 hover:translate-y-0 hover:bg-transparent hover:text-[#3286C8] hover:underline hover:shadow-none",
      },
      size: {
        default: "h-11 px-6 py-3 text-sm",
        sm: "h-9 px-4 py-2 text-sm",
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
