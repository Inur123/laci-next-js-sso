"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  className?: string;
  duration?: number; // ms
  formatter?: (value: number) => string;
}

export function NumberTicker({
  value = 0,
  className,
  duration = 1000,
  formatter = (v) => (v != null ? v.toString() : "0"),
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(value || 0);
  const previousValueRef = useRef(value || 0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const endValue = value;

    if (startValue === endValue) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = timestamp - startTimeRef.current;
      const percentage = Math.min(progress / duration, 1);

      // Easing function: easeOutExpo
      const easing = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);

      const current = Math.floor(startValue + (endValue - startValue) * easing);
      setDisplayValue(current);

      if (percentage < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValueRef.current = endValue;
        startTimeRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startTimeRef.current = null;
    };
  }, [value, duration]);

  return (
    <span className={cn("tabular-nums", className)}>
      {formatter(displayValue)}
    </span>
  );
}
