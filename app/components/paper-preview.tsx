import { type ReactNode, useEffect, useRef, useState } from "react";

/** US Letter at 96 CSS px per inch. */
const pageWidth = 816;
const pageHeight = 1056;

/**
 * A document on real paper proportions, scaled down to fit its column, with
 * page-break markers where the PDF will break.
 */
export function PaperPreview({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(pageHeight);

  useEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    if (!frame || !page) return;
    const measure = () => {
      setScale(Math.min(1, frame.clientWidth / pageWidth));
      setHeight(Math.max(pageHeight, page.scrollHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  const pages = Math.ceil(height / pageHeight);

  return (
    <section aria-label={label}>
      <div className="mb-2 flex items-baseline justify-between text-[0.8125rem] text-ink-3">
        <span>ATS-safe preview · Letter</span>
        <span className="tabular">
          {pages} {pages === 1 ? "page" : "pages"}
        </span>
      </div>
      <div
        ref={frameRef}
        style={{ height: height * scale }}
        className="relative w-full overflow-hidden"
      >
        <div
          ref={pageRef}
          style={{
            width: pageWidth,
            minHeight: pageHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="absolute top-0 left-0 bg-white px-[72px] py-[64px] font-sans text-[13px] leading-[1.45] text-[#111] shadow-sheet"
        >
          {children}
          {Array.from({ length: pages - 1 }, (_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: page markers are positional.
              key={index}
              aria-hidden="true"
              style={{ top: (index + 1) * pageHeight }}
              className="absolute inset-x-0 border-t border-dashed border-margin/70"
            >
              <span className="absolute -top-2.5 right-2 bg-white px-1 text-[10px] text-margin">
                Page {index + 2}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
