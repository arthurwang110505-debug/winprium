// 素材縮圖:用同一套 drawAssetFrame 畫出素材的某一格,當作即時預覽縮圖。

import { useEffect, useRef } from "react";
import { drawAssetFrame } from "../assets";
import type { Asset, ClipFilters } from "../types";

interface Props {
  asset: Asset;
  width?: number;
  height?: number;
  t?: number; // 素材內部時間 0..1
  filters?: ClipFilters;
  className?: string;
}

export default function AssetThumb({
  asset,
  width = 160,
  height = 90,
  t = 0.35,
  filters,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    drawAssetFrame(ctx, width, height, asset, t, filters ?? {});
  }, [asset, width, height, t, filters]);

  if (asset.kind === "video" && asset.videoUrl) {
    return (
      <video
        src={asset.videoUrl}
        muted
        playsInline
        preload="metadata"
        className={className}
        style={{ width: "100%", height: "auto", objectFit: "cover", background: "#000" }}
      />
    );
  }

  return <canvas ref={ref} width={width} height={height} className={className} />;
}
