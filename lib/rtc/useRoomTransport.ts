"use client";
/* React wrapper around createRoomTransport.
 *
 * Owns one transport for the given (room, role), exposes its status/mode/peer
 * count reactively, a stable `send`, and a message subscription. Handlers
 * registered before the transport exists are re-attached when it (re)builds. */
import React from "react";
import {
	createRoomTransport,
	defaultSignalUrl,
	type RoomTransport,
	type TransportSnapshot,
} from "@/lib/rtc/roomTransport";
import type { PeerRole } from "@/lib/rtc/peer";

const { useCallback, useEffect, useRef, useState } = React;

export interface UseRoomTransport {
	snapshot: TransportSnapshot;
	send: (data: unknown) => void;
	onMessage: (handler: (data: unknown) => void) => () => void;
}

export function useRoomTransport(
	room: string | null,
	role: PeerRole,
	url?: string,
): UseRoomTransport {
	const transportRef = useRef<RoomTransport | null>(null);
	const handlersRef = useRef(new Set<(data: unknown) => void>());
	const [snapshot, setSnapshot] = useState<TransportSnapshot>({
		status: "connecting",
		mode: null,
		peers: 0,
	});

	useEffect(() => {
		if (!room) return undefined;
		const transport = createRoomTransport({
			url: url ?? defaultSignalUrl(),
			room,
			role,
		});
		transportRef.current = transport;
		setSnapshot(transport.getSnapshot());
		const offStatus = transport.onStatus(setSnapshot);
		handlersRef.current.forEach((handler) => transport.onMessage(handler));
		return () => {
			offStatus();
			transport.close();
			transportRef.current = null;
		};
	}, [room, role, url]);

	const send = useCallback((data: unknown) => {
		transportRef.current?.send(data);
	}, []);

	const onMessage = useCallback((handler: (data: unknown) => void) => {
		handlersRef.current.add(handler);
		const detach = transportRef.current?.onMessage(handler);
		return () => {
			handlersRef.current.delete(handler);
			detach?.();
		};
	}, []);

	return { snapshot, send, onMessage };
}
