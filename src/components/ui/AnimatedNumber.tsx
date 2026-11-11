import { useState, useEffect, useRef } from 'react';
import { useSpring, useMotionValue } from 'framer-motion';

export function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 20, mass: 1 });
  const [display, setDisplay] = useState('0');
  const prevValue = useRef(0);

  useEffect(() => {
    motionValue.set(prevValue.current);
    motionValue.set(value);
    prevValue.current = value;
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => {
      setDisplay(Math.round(v).toLocaleString());
    });
    return unsubscribe;
  }, [spring]);

  return <>{prefix}{display}{suffix}</>;
}
