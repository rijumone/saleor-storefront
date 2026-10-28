"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	/** Controlled checked state */
	checked?: boolean;
	/** Callback when checked state changes */
	onCheckedChange?: (checked: boolean) => void;
}

/**
 * shadcn/ui style Checkbox component.
 * Custom styled checkbox with check icon.
 *
 * The visual square sits inside a `<label>` together with the input, so a click
 * anywhere on the square toggles the checkbox. The checked styling comes from
 * CSS (`peer-checked`), so the square also updates when the input is used
 * uncontrolled (`defaultChecked`).
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
	({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			onChange?.(e);
			onCheckedChange?.(e.target.checked);
		};

		return (
			<label className="relative inline-flex cursor-pointer items-center">
				<input
					type="checkbox"
					ref={ref}
					{...props}
					checked={checked}
					onChange={handleChange}
					className="peer sr-only"
				/>
				<div
					className={cn(
						"flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
						"border-input bg-background text-transparent ring-offset-background",
						"peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background",
						"peer-focus-visible:outline-hidden peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
						"peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
						className,
					)}
					aria-hidden="true"
				>
					<Check className="h-3.5 w-3.5" strokeWidth={3} />
				</div>
			</label>
		);
	},
);

Checkbox.displayName = "Checkbox";
