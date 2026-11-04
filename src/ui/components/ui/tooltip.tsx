"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TooltipAlign = "start" | "center" | "end";

type TooltipProps = {
	label: string;
	children: ReactNode;
	align?: TooltipAlign;
	className?: string;
};

/**
 * Small themed tooltip for icon-only controls.
 *
 * The tooltip is visual; the focusable child keeps its own accessible name
 * (usually `aria-label`). We still link the two with `aria-describedby` so
 * keyboard and screen-reader users get the same explanation.
 */
export function Tooltip({ label, children, align = "center", className }: TooltipProps) {
	const id = useId();

	const child = isValidElement(children)
		? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
				"aria-describedby": [
					(children as ReactElement<{ "aria-describedby"?: string }>).props["aria-describedby"],
					id,
				]
					.filter(Boolean)
					.join(" "),
			})
		: children;

	return (
		<span className="group relative inline-flex">
			{child}
			<span
				id={id}
				role="tooltip"
				className={cn(
					"pointer-events-none absolute bottom-full z-50 mb-2 whitespace-nowrap rounded-md border border-border bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md",
					"opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
					align === "start" && "left-0",
					align === "center" && "left-1/2 -translate-x-1/2",
					align === "end" && "right-0",
					className,
				)}
			>
				{label}
			</span>
		</span>
	);
}
