"use client";
import React from "react";

export function useClock() {
	const [t, setT] = React.useState("");
	React.useEffect(() => {
		const tick = () => {
			const d = new Date();
			const p = (n: number) => String(n).padStart(2, "0");
			setT(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
		};
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, []);
	return t;
}
