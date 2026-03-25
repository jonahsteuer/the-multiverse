import type { EditPiece } from '@/app/api/mark-edit/route';

export interface ExportQueueItem {
  pieceIndex: number;
  piece: EditPiece;
  status: 'queued' | 'exporting' | 'done' | 'error';
  progress: number; // 0–1
  blob?: Blob;
  errorMessage?: string;
}

export type ExportQueueUpdate = (items: ExportQueueItem[]) => void;

/**
 * Processes pieces one at a time (browser WASM can't parallelize).
 * Calls onUpdate after each state change so the UI can re-render.
 * Failed pieces are skipped — they don't block the queue.
 */
export async function processExportQueue(
  pieces: EditPiece[],
  audioUrl: string | null,
  exportFn: (
    piece: { piece: EditPiece; timeline: import('@/components/remotion/EditPreviewComposition').EditClip[] },
    audioUrl: string | null,
    width: number,
    height: number,
    onProgress: (pct: number) => void,
  ) => Promise<Blob | null>,
  getTimeline: (piece: EditPiece) => import('@/components/remotion/EditPreviewComposition').EditClip[],
  getSize: (aspectRatio: string) => { width: number; height: number },
  onUpdate: ExportQueueUpdate,
): Promise<ExportQueueItem[]> {
  // Initialise queue
  let items: ExportQueueItem[] = pieces.map((piece, i) => ({
    pieceIndex: i,
    piece,
    status: 'queued' as const,
    progress: 0,
  }));
  onUpdate([...items]);

  for (let i = 0; i < items.length; i++) {
    // Mark as exporting
    items = items.map((item, idx) =>
      idx === i ? { ...item, status: 'exporting' as const, progress: 0 } : item,
    );
    onUpdate([...items]);

    try {
      const timeline = getTimeline(items[i].piece);
      const { width, height } = getSize(items[i].piece.aspectRatio ?? '9:16');
      const pieceState = { piece: items[i].piece, timeline };

      const blob = await exportFn(
        pieceState,
        audioUrl,
        width,
        height,
        (pct) => {
          items = items.map((item, idx) =>
            idx === i ? { ...item, progress: pct } : item,
          );
          onUpdate([...items]);
        },
      );

      items = items.map((item, idx) =>
        idx === i
          ? { ...item, status: 'done' as const, progress: 1, blob: blob ?? undefined }
          : item,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      items = items.map((item, idx) =>
        idx === i ? { ...item, status: 'error' as const, progress: 0, errorMessage: msg } : item,
      );
      console.error(`[export-queue] piece ${i} failed:`, err);
    }

    onUpdate([...items]);
  }

  return items;
}
