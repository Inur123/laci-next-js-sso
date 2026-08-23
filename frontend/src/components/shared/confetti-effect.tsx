"use client";

import { useEffect } from "react";

export function ConfettiEffect() {
  useEffect(() => {
    import("canvas-confetti").then((confetti) => {
      // Sekali tembak meriam dari tengah bawah (Corong Kecil ke Atas Besar)
      confetti.default({
        particleCount: 300,
        angle: 90,
        spread: 100,
        origin: { x: 0.5, y: 1 },
        startVelocity: 80,
        gravity: 0.4,
        ticks: 500,
        scalar: 0.8,
        zIndex: 9999,
        colors: [
          "#22c55e",
          "#3b82f6",
          "#f59e0b",
          "#ef4444",
          "#ec4899",
          "#8b5cf6",
        ],
      });
    });
  }, []);

  return null;
}
