"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/ui/components/ui/input";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	/** Extra classes for the relative wrapper that positions the icons. */
	containerClassName?: string;
}

/**
 * Password field with its own show/hide control.
 *
 * Every password field owns its visibility state. Sharing one flag across a
 * form (or omitting the control on a confirm field) leaks or hides values the
 * user did not ask to change.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
	({ className, containerClassName, disabled, ...props }, ref) => {
		const [visible, setVisible] = useState(false);

		return (
			<div className={cn("relative", containerClassName)}>
				<Lock
					aria-hidden="true"
					className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					ref={ref}
					type={visible ? "text" : "password"}
					className={cn("pl-10 pr-10", className)}
					disabled={disabled}
					{...props}
				/>
				<button
					type="button"
					onClick={() => setVisible((current) => !current)}
					aria-label={visible ? "Hide password" : "Show password"}
					aria-pressed={visible}
					disabled={disabled}
					className="focus-visible:outline-hidden absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
				</button>
			</div>
		);
	},
);

PasswordInput.displayName = "PasswordInput";
