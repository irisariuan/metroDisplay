"use client";

import React from "react";

interface AnimatedVisibilityProps
	extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
	visible?: boolean;
	enterAnimation: string;
	exitAnimation: string;
	exitDurationMs?: number;
	children: React.ReactNode;
}

// Keeps its child mounted until the exit animation has completed. The wrapper
// itself remains in the layout, which also supports reserved-space UI rows.
export function AnimatedVisibility({
	visible,
	enterAnimation,
	exitAnimation,
	exitDurationMs = 320,
	children,
	style,
	...props
}: AnimatedVisibilityProps) {
	const childIsPresent =
		children !== null && children !== undefined && children !== false;
	const isVisible = visible ?? childIsPresent;
	const [rendered, setRendered] = React.useState(isVisible);
	const [leaving, setLeaving] = React.useState(false);
	const [displayChildren, setDisplayChildren] = React.useState(children);

	React.useEffect(() => {
		if (!isVisible) return undefined;
		const contentId = setTimeout(() => setDisplayChildren(children), 0);
		return () => clearTimeout(contentId);
	}, [children, isVisible]);

	React.useEffect(() => {
		if (isVisible) {
			const showId = setTimeout(() => {
				setRendered(true);
				setLeaving(false);
			}, 0);
			return () => clearTimeout(showId);
		}
		if (!rendered) return undefined;
		const leaveId = setTimeout(() => setLeaving(true), 0);
		const hideId = setTimeout(() => {
			setRendered(false);
			setLeaving(false);
		}, exitDurationMs);
		return () => {
			clearTimeout(leaveId);
			clearTimeout(hideId);
		};
	}, [exitDurationMs, isVisible, rendered]);

	return (
		<div
			{...props}
			data-visibility-state={
				rendered ? (leaving ? "leaving" : "visible") : "hidden"
			}
			style={{
				...style,
				animation: rendered
					? leaving
						? exitAnimation
						: enterAnimation
					: "none",
			}}
		>
			{rendered ? displayChildren : null}
		</div>
	);
}
