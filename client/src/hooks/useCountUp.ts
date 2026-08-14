import { useEffect, useState, useRef } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number; // in milliseconds
  decimals?: number;
  start?: number;
  delay?: number; // delay before starting animation
}

export function useCountUp({
  end,
  duration = 2000,
  decimals = 0,
  start = 0,
  delay = 0,
}: UseCountUpOptions) {
  const [count, setCount] = useState(start);
  const [isComplete, setIsComplete] = useState(false);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    const startAnimation = () => {
      startTimeRef.current = undefined;
      setCount(start);
      setIsComplete(false);

      const animate = (currentTime: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = currentTime;
        }

        const elapsed = currentTime - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation (ease-out)
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        const currentCount = start + (end - start) * easeOutQuart;
        setCount(currentCount);

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          setCount(end);
          setIsComplete(true);
        }
      };

      frameRef.current = requestAnimationFrame(animate);
    };

    // Start after delay
    const timeoutId = setTimeout(startAnimation, delay);

    return () => {
      clearTimeout(timeoutId);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration, start, delay]);

  return {
    value: Number(count.toFixed(decimals)),
    isComplete,
  };
}
