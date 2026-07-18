import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "水下地鐵 · Metro Announcement System",
	description: "Metro Announcement System — Shuika Metro line simulator",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<div className="stage-bg" />
				<div id="root">{children}</div>
			</body>
		</html>
	);
}
