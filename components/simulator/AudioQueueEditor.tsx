"use client";

import React from "react";
import type {
	AnnouncementQueue,
	AnnouncementQueueItem,
} from "./AnnouncementAudio";

interface AudioQueueEditorProps {
	queue: AnnouncementQueue;
	onMove: (id: string, toIndex: number) => void;
	onRemove: (id: string) => void;
	onMoveClip: (
		sequenceId: string,
		fromIndex: number,
		toIndex: number,
	) => void;
	onRemoveClip: (sequenceId: string, clipIndex: number) => void;
	onStopAll: () => void;
}

interface ClipListProps {
	item: AnnouncementQueueItem;
	editable: boolean;
	onMoveClip: AudioQueueEditorProps["onMoveClip"];
	onRemoveClip: AudioQueueEditorProps["onRemoveClip"];
}

function ClipList({
	item,
	editable,
	onMoveClip,
	onRemoveClip,
}: ClipListProps) {
	const [dragClipIndex, setDragClipIndex] = React.useState<number | null>(null);
	const [dragOverClipIndex, setDragOverClipIndex] = React.useState<
		number | null
	>(null);
	const unavailableCount = item.clips.length - item.clipCount;
	const hasEditableClips = editable && item.clips.some((clip) => clip.editable);
	const finishClipDrag = () => {
		setDragClipIndex(null);
		setDragOverClipIndex(null);
	};
	const dropOnClip = (targetIndex: number) => {
		if (dragClipIndex !== null && dragClipIndex !== targetIndex)
			onMoveClip(item.id, dragClipIndex, targetIndex);
		finishClipDrag();
	};

	return (
		<details className="mt-2 border-t-2 border-ink/20 pt-2">
			<summary className="cursor-pointer select-none font-mono text-[9px] font-bold tracking-widest text-muted hover:text-ink">
				{hasEditableClips ? "VIEW / EDIT" : "VIEW"} {item.clips.length} CLIP
				{item.clips.length === 1 ? "" : "S"}
				{unavailableCount
					? ` · ${unavailableCount} UNAVAILABLE`
					: ""}
			</summary>
			<ol className="mt-2 flex flex-col gap-1.5">
				{item.clips.map((clip, clipPosition) => {
					const canEdit = editable && clip.editable;
					const firstEditablePosition = item.clips.findIndex(
						(candidate) => candidate.editable,
					);
					return (
					<li
						key={`${clip.index}-${clip.key}`}
						onDragEnter={
							canEdit
								? (event) => {
										event.stopPropagation();
										if (dragClipIndex !== null)
											setDragOverClipIndex(clip.index);
									}
								: undefined
						}
						onDragOver={
							canEdit
								? (event) => {
										event.preventDefault();
										event.stopPropagation();
									}
								: undefined
						}
						onDrop={
							canEdit
								? (event) => {
										event.preventDefault();
										event.stopPropagation();
										dropOnClip(clip.index);
									}
								: undefined
						}
						className={`flex items-center gap-2 rounded-[5px] border-2 border-ink px-2 py-1.5 ${
							dragOverClipIndex === clip.index &&
							dragClipIndex !== clip.index
								? "bg-magenta"
								: clip.playable
									? "bg-paper"
									: "bg-paper-2 opacity-55"
						} ${dragClipIndex === clip.index ? "opacity-45" : ""}`}
					>
						{canEdit ? (
							<span
								draggable
								onDragStart={(event) => {
									event.stopPropagation();
									setDragClipIndex(clip.index);
								}}
								onDragEnd={(event) => {
									event.stopPropagation();
									finishClipDrag();
								}}
								className="cursor-grab select-none font-mono text-sm active:cursor-grabbing"
								title="Drag clip to reorder"
								aria-label={`Drag clip ${clipPosition + 1} to reorder`}
							>
								⠿
							</span>
						) : null}
						<span className="w-5 shrink-0 font-mono text-[9px] font-bold text-muted">
							{clipPosition + 1}.
						</span>
						<div className="min-w-0 flex-1">
							<div className="truncate font-mono text-[10px] font-bold">
								{clip.label}
							</div>
							<div className="truncate font-mono text-[8px] font-bold tracking-wide text-muted">
								{[clip.lang?.toUpperCase(), clip.category, clip.key]
									.filter(Boolean)
									.join(" · ")}
							</div>
						</div>
						{canEdit ? (
							<div className="flex shrink-0 gap-1">
								<button
									type="button"
									className="h-7 w-7 cursor-pointer rounded-[4px] border-2 border-ink bg-paper font-mono text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-30"
									onClick={() =>
										onMoveClip(item.id, clip.index, clip.index - 1)
									}
									disabled={clipPosition === firstEditablePosition}
									aria-label={`Move clip ${clipPosition + 1} earlier in ${item.label}`}
								>
									↑
								</button>
								<button
									type="button"
									className="h-7 w-7 cursor-pointer rounded-[4px] border-2 border-ink bg-paper font-mono text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-30"
									onClick={() =>
										onMoveClip(item.id, clip.index, clip.index + 1)
									}
									disabled={clipPosition === item.clips.length - 1}
									aria-label={`Move clip ${clipPosition + 1} later in ${item.label}`}
								>
									↓
								</button>
								<button
									type="button"
									className="h-7 w-7 cursor-pointer rounded-[4px] border-2 border-ink bg-magenta font-mono text-[10px] font-bold"
									onClick={() => onRemoveClip(item.id, clip.index)}
									aria-label={`Remove clip ${clipPosition + 1} from ${item.label}`}
									title="Remove clip"
								>
									✕
								</button>
							</div>
						) : (
							<span className="shrink-0 rounded-[4px] border border-ink px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest">
								{clip.state.toUpperCase()}
							</span>
						)}
					</li>
					);
				})}
			</ol>
		</details>
	);
}

export function AudioQueueEditor({
	queue,
	onMove,
	onRemove,
	onMoveClip,
	onRemoveClip,
	onStopAll,
}: AudioQueueEditorProps) {
	const [open, setOpen] = React.useState(false);
	const [dragId, setDragId] = React.useState<string | null>(null);
	const [dragOverId, setDragOverId] = React.useState<string | null>(null);
	const dialogRef = React.useRef<HTMLDialogElement>(null);
	const closeButtonRef = React.useRef<HTMLButtonElement>(null);

	React.useEffect(() => {
		if (!open) return;
		dialogRef.current?.showModal();
		closeButtonRef.current?.focus();
	}, [open]);

	const finishDrag = () => {
		setDragId(null);
		setDragOverId(null);
	};

	const dropOn = (targetId: string) => {
		if (dragId && dragId !== targetId) {
			const targetIndex = queue.pending.findIndex(
				(item) => item.id === targetId,
			);
			if (targetIndex !== -1) onMove(dragId, targetIndex);
		}
		finishDrag();
	};

	return (
		<>
			<button
				type="button"
				className="cursor-pointer rounded-[5px] border-2 border-ink bg-paper px-2 py-1 font-mono text-[10px] font-bold tracking-widest hover:bg-acid"
				onClick={() => setOpen(true)}
				aria-haspopup="dialog"
			>
				EXPAND ↗
			</button>

			{open ? (
				<dialog
					ref={dialogRef}
					aria-modal="true"
					aria-labelledby="audio-queue-title"
					className="fixed inset-0 z-50 m-auto max-h-[min(760px,calc(100dvh-32px))] w-[min(720px,calc(100vw-32px))] overflow-hidden rounded-xl border-3 border-ink bg-paper p-0 text-ink shadow-[10px_10px_0_var(--ink)] backdrop:bg-ink/80"
					onCancel={(event) => {
						event.preventDefault();
						setOpen(false);
					}}
					onClose={() => setOpen(false)}
					onClick={(event) => {
						if (event.target === event.currentTarget) setOpen(false);
					}}
				>
					<div className="flex max-h-[min(760px,calc(100dvh-32px))] flex-col">
						<header className="flex items-start justify-between gap-4 border-b-3 border-ink bg-magenta p-4">
							<div>
								<div className="font-mono text-[10px] font-bold tracking-[.18em]">
									PLAYBACK CONTROL
								</div>
								<h2
									id="audio-queue-title"
									className="font-display text-[34px] leading-none tracking-wide"
								>
									AUDIO QUEUE
								</h2>
							</div>
							<button
								ref={closeButtonRef}
								type="button"
								className="cursor-pointer rounded-[5px] border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold hover:bg-acid"
								onClick={() => setOpen(false)}
								aria-label="Close audio queue"
							>
								✕ CLOSE
							</button>
						</header>

						<div className="overflow-y-auto p-4">
							<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
								<div className="font-mono text-xs font-bold tracking-widest">
									{queue.pending.length} WAITING
								</div>
								<button
									type="button"
									className="cursor-pointer rounded-[5px] border-2 border-ink bg-acid px-3 py-1.5 font-mono text-[10px] font-bold tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
									onClick={onStopAll}
									disabled={!queue.current && !queue.pending.length}
								>
									■ STOP + CLEAR ALL
								</button>
							</div>

							<section aria-labelledby="audio-now-playing">
								<h3
									id="audio-now-playing"
									className="mb-1.5 font-mono text-[10px] font-bold tracking-[.16em] text-muted"
								>
									NOW PLAYING
								</h3>
								<div className="mb-4 rounded-md border-2 border-ink bg-acid p-3">
									{queue.current ? (
										<div className="flex items-start gap-3">
											<span
												className="text-lg"
												aria-hidden
											>
												▶
											</span>
											<div className="min-w-0 flex-1">
												<div className="truncate font-mono text-xs font-bold">
													{queue.current.label}
												</div>
												<div className="mt-0.5 font-mono text-[9px] font-bold tracking-widest text-muted">
													{queue.current.source.toUpperCase()} ·{" "}
													{queue.current.clipCount} CLIP
													{queue.current.clipCount === 1 ? "" : "S"}
												</div>
												<ClipList
													item={queue.current}
													editable
													onMoveClip={onMoveClip}
													onRemoveClip={onRemoveClip}
												/>
											</div>
										</div>
									) : (
										<div className="font-mono text-[10px] font-bold tracking-widest text-muted">
											NOTHING PLAYING
										</div>
									)}
								</div>
							</section>

							<section aria-labelledby="audio-up-next">
								<div className="mb-1.5 flex items-end justify-between gap-3">
									<h3
										id="audio-up-next"
										className="font-mono text-[10px] font-bold tracking-[.16em] text-muted"
									>
										UP NEXT
									</h3>
									<span className="font-mono text-[9px] font-bold tracking-widest text-muted">
										DRAG OR USE ARROWS TO REORDER
									</span>
								</div>

								{queue.pending.length ? (
									<ol className="flex flex-col gap-2">
										{queue.pending.map((item, index) => (
											<li
												key={item.id}
												onDragEnter={() => {
													if (dragId) setDragOverId(item.id);
												}}
												onDragOver={(event) => event.preventDefault()}
												onDrop={() => dropOn(item.id)}
												className={`rounded-md border-2 border-ink p-2 ${
													dragOverId === item.id &&
													dragId !== item.id
														? "bg-magenta"
														: "bg-paper-2"
												} ${dragId === item.id ? "opacity-50" : ""}`}
											>
												<div className="flex items-center gap-2">
													<span
														draggable
														onDragStart={() => setDragId(item.id)}
														onDragEnd={finishDrag}
														className="cursor-grab select-none font-mono text-lg active:cursor-grabbing"
														title="Drag to reorder"
														aria-hidden
													>
														⠿
													</span>
													<span className="w-5 shrink-0 font-mono text-xs font-bold">
														{index + 1}.
													</span>
													<div className="min-w-0 flex-1">
														<div className="truncate font-mono text-xs font-bold">
															{item.label}
														</div>
														<div className="mt-0.5 font-mono text-[9px] font-bold tracking-widest text-muted">
															{item.source.toUpperCase()} ·{" "}
															{item.clipCount} PLAYABLE CLIP
															{item.clipCount === 1 ? "" : "S"}
														</div>
													</div>
													<div className="flex shrink-0 gap-1">
														<button
															type="button"
															className="h-8 w-8 cursor-pointer rounded-[5px] border-2 border-ink bg-paper font-mono text-xs font-bold disabled:cursor-not-allowed disabled:opacity-30"
															onClick={() => onMove(item.id, index - 1)}
															disabled={index === 0}
															aria-label={`Move ${item.label} earlier`}
														>
															↑
														</button>
														<button
															type="button"
															className="h-8 w-8 cursor-pointer rounded-[5px] border-2 border-ink bg-paper font-mono text-xs font-bold disabled:cursor-not-allowed disabled:opacity-30"
															onClick={() => onMove(item.id, index + 1)}
															disabled={
																index === queue.pending.length - 1
															}
															aria-label={`Move ${item.label} later`}
														>
															↓
														</button>
														<button
															type="button"
															className="h-8 w-8 cursor-pointer rounded-[5px] border-2 border-ink bg-magenta font-mono text-xs font-bold"
															onClick={() => onRemove(item.id)}
															aria-label={`Remove ${item.label} from queue`}
															title="Remove from queue"
														>
															✕
														</button>
													</div>
												</div>
												<ClipList
													item={item}
													editable
													onMoveClip={onMoveClip}
													onRemoveClip={onRemoveClip}
												/>
											</li>
										))}
									</ol>
								) : (
									<div className="rounded-md border-2 border-dashed border-ink p-5 text-center font-mono text-[10px] font-bold tracking-widest text-muted">
										QUEUE IS EMPTY
									</div>
								)}
							</section>
						</div>
					</div>
				</dialog>
			) : null}
		</>
	);
}
