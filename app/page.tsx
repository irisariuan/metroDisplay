import Link from "next/link";
import { MetroSimulator } from "@/components/simulator/MetroSimulator";

export default function Home() {
	return (
		<main className="relative z-1 mx-auto max-w-screen px-5.5 pt-6.5 pb-10">
			<MetroSimulator>
				<div>
					<div className="font-mono text-sm tracking-[.22em] text-acid">
						SHUIKA METRO · IN-CAR DISPLAY
					</div>
					<div className="font-display text-[46px] leading-[0.95] text-paper">
						水下地鐵 車内案内
					</div>
					<div className="mt-2 flex gap-4 font-mono text-xs tracking-widest text-paper-2">
						<span className="opacity-60">SPLIT ACROSS DEVICES →</span>
						<Link href="/display" className="underline hover:text-acid">
							DISPLAY
						</Link>
						<Link href="/control" className="underline hover:text-acid">
							CONTROL
						</Link>
					</div>
				</div>
			</MetroSimulator>
		</main>
	);
}
