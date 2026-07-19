"use client";
import React from "react";

interface FullAlertMessageProps {
	message: string;
}

export function FullAlertMessage({ message }: FullAlertMessageProps) {
	const boxRef = React.useRef<HTMLDivElement>(null);
	const textRef = React.useRef<HTMLDivElement>(null);
	const [fontSize, setFontSize] = React.useState(72);

	React.useLayoutEffect(() => {
		const box = boxRef.current;
		const text = textRef.current;
		if (!box || !text) return undefined;
		const fit = () => {
			let size = Math.max(
				32,
				Math.min(
					180,
					Math.floor(box.clientWidth * 0.28),
					Math.floor(box.clientHeight * 0.95),
				),
			);
			text.style.fontSize = `${size}px`;
			while (text.scrollHeight > box.clientHeight && size > 32) {
				size -= 2;
				text.style.fontSize = `${size}px`;
			}
			setFontSize(size);
		};
		fit();
		if (typeof ResizeObserver === "undefined") return undefined;
		const observer = new ResizeObserver(fit);
		observer.observe(box);
		return () => observer.disconnect();
	}, [message]);

	return (
		<div
			ref={boxRef}
			className="flex h-full w-full items-center overflow-hidden"
		>
			<div
				ref={textRef}
				className="wrap-break-word uppercase font-display tracking-[.01em] leading-[0.85]"
				style={{ fontSize }}
			>
				{message}
			</div>
		</div>
	);
}
