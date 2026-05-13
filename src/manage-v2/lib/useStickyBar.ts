import { useState, useEffect, type RefObject } from "react";

export function useStickyBar(ref: RefObject<HTMLElement>) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);

  return show;
}
