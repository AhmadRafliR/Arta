import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

export type NodeView = ComponentRef<typeof View>;

/** Kotak dalam koordinat jendela. */
export type Kotak = { x: number; y: number; w: number; h: number };

export type TargetTur = {
  ref: RefObject<NodeView | null>;
  /** Menggulir layar pemilik supaya target terlihat (opsional). */
  gulir?: () => void;
};

// Elemen di layar yang bisa disorot tur, didaftarkan oleh <TargetTur id=...>.
const peta = new Map<string, TargetTur>();

export function daftarTarget(id: string, target: TargetTur): () => void {
  peta.set(id, target);
  return () => {
    if (peta.get(id) === target) peta.delete(id);
  };
}

export function ambilTarget(id: string): TargetTur | undefined {
  return peta.get(id);
}

const BATAS_UKUR_MS = 400;

/** Ukur posisi elemen di jendela; null bila tidak ter-mount, tak terlihat, atau tidak menjawab tepat waktu. */
export function ukur(ref: RefObject<NodeView | null>): Promise<Kotak | null> {
  return new Promise((selesai) => {
    const node = ref.current;
    if (!node) {
      selesai(null);
      return;
    }
    let beres = false;
    const batas = setTimeout(() => {
      if (beres) return;
      beres = true;
      selesai(null);
    }, BATAS_UKUR_MS);
    try {
      node.measureInWindow((x, y, w, h) => {
        if (beres) return;
        beres = true;
        clearTimeout(batas);
        selesai(w > 0 && h > 0 ? { x, y, w, h } : null);
      });
    } catch {
      beres = true;
      clearTimeout(batas);
      selesai(null);
    }
  });
}
