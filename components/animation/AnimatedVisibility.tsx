"use client";

import React from "react";

interface AnimatedVisibilityProps {
	exitDurationMs?: number;
	children: React.ReactElement | null | false;
}

// Retains the last child for its exit animation without adding a DOM element
// or owning any visual styles. Consumers animate the cloned child with the
// data-visibility-state attribute.
export function AnimatedVisibility({
	exitDurationMs = 320,
	children,
}: AnimatedVisibilityProps) {
	const child = React.isValidElement(children) ? children : null;
	const isVisible = child !== null;
	const [rendered, setRendered] = React.useState(isVisible);
	const [leaving, setLeaving] = React.useState(false);
	const [displayChild, setDisplayChild] =
		React.useState<React.ReactElement | null>(child);

	React.useEffect(() => {
		if (!child) return undefined;
		const contentId = setTimeout(() => setDisplayChild(child), 0);
		return () => clearTimeout(contentId);
	}, [child]);

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

	if (!rendered || !displayChild) return null;

	return React.cloneElement(
		displayChild as React.ReactElement<Record<string, unknown>>,
		{
			"data-visibility-state": leaving ? "leaving" : "visible",
		},
	);
}
