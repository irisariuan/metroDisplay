"use client";
/* Reads the `?room=` pairing code from the URL. The display generates a fresh
 * code when none is present and reflects it into the URL so it can be shared.
 *
 * `window.location` is mutable state outside React, so the read is wired
 * through useSyncExternalStore rather than mirrored into useState from an
 * effect — that avoids both a hydration mismatch (server has no URL to read)
 * and the "setState in an effect" anti-pattern for syncing external state. */
import React from "react";

const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusable 0/O/1/I/L

export function randomRoomCode(length = 6): string {
	let code = "";
	for (let i = 0; i < length; i += 1)
		code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
	return code;
}

// Nothing external fires an event when we rewrite the URL ourselves (history
// replaceState is silent), so this tiny listener set lets us notify the store
// manually right after we mutate it. popstate covers back/forward navigation.
const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
	listeners.add(onChange);
	window.addEventListener("popstate", onChange);
	return () => {
		listeners.delete(onChange);
		window.removeEventListener("popstate", onChange);
	};
}
function notify() {
	listeners.forEach((listener) => listener());
}
function getRoomSnapshot(): string | null {
	return new URLSearchParams(window.location.search).get("room");
}
function getServerRoomSnapshot(): string | null {
	return null;
}

export function useRoomParam(generateIfMissing: boolean): string | null {
	const room = React.useSyncExternalStore(
		subscribe,
		getRoomSnapshot,
		getServerRoomSnapshot,
	);

	React.useEffect(() => {
		if (room || !generateIfMissing) return;
		const params = new URLSearchParams(window.location.search);
		params.set("room", randomRoomCode());
		window.history.replaceState(
			null,
			"",
			`${window.location.pathname}?${params.toString()}`,
		);
		notify();
	}, [room, generateIfMissing]);

	return room ? room.toUpperCase() : null;
}
