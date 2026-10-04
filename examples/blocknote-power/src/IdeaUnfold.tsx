import { useEffect, useRef } from "react";
import { installDecorativeMotion } from "./decorativeMotion.mjs";

const assetBase = `${import.meta.env.BASE_URL}motion/idea-unfold`;

/** Ornament only: it never controls editor, agent or save state. */
export function IdeaUnfold({ once }: { once: { current: boolean } }) {
  const well = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!well.current) return;
    const motion = installDecorativeMotion(well.current, { assetBase, once });
    return () => motion.dispose();
  }, [once]);
  return (
    <div ref={well} className="demo-motion-well" aria-hidden="true">
      <picture>
        <source srcSet={`${assetBase}/reduced-motion.webp`} type="image/webp" />
        <img src={`${assetBase}/reduced-motion.png`} alt="" width={640} height={480} />
      </picture>
    </div>
  );
}
