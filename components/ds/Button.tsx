"use client";

import type { MouseEventHandler, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "accent" | "dark" | "ghost";
type ButtonSize = "s" | "m" | "l";

interface ButtonProps {
	variant?: ButtonVariant;
	size?: ButtonSize;
	disabled?: boolean;
	children?: ReactNode;
	onClick?: MouseEventHandler<HTMLButtonElement>;
	className?: string;
}

const sizeClasses: Record<ButtonSize, string> = {
	s: "px-[18px] py-2 text-body-s",
	m: "px-[26px] py-3 text-body",
	l: "px-[34px] py-4 text-body-l",
};

const variantClasses: Record<ButtonVariant, string> = {
	primary: "bg-primary text-ink shadow-hard-s active:shadow-none",
	secondary: "bg-secondary text-ink shadow-hard-s active:shadow-none",
	accent: "bg-accent text-ink shadow-hard-s active:shadow-none",
	dark: "bg-ink text-paper shadow-hard-s active:shadow-none",
	ghost: "bg-transparent text-ink shadow-none",
};

export function Button({
	variant = "primary",
	size = "m",
	disabled = false,
	children,
	onClick,
	className = "",
}: ButtonProps) {
	return (
		<button
			disabled={disabled}
			onClick={onClick}
			className={[
				"inline-flex items-center gap-2 rounded-pill border-[3px] border-ink font-body font-bold tracking-[-0.01em]",
				"transition-transform duration-[120ms] ease-pop active:translate-x-[3px] active:translate-y-[3px]",
				disabled ? "cursor-not-allowed opacity-45 shadow-none" : "cursor-pointer",
				sizeClasses[size],
				variantClasses[variant],
				className,
			].join(" ")}
		>
			{children}
		</button>
	);
}
