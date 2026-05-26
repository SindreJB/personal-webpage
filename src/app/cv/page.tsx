export default function CvPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-12 pb-20">
      <div className="brutal bg-bubblegum shadow-chunk-lg p-6 mb-8">
        <p className="font-mono text-xs bg-white brutal inline-block px-2 py-0.5 shadow-chunk-sm">/cv</p>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">curriculum vitae 📄</h1>
        <p className="mt-3 font-body">the professional™ version of me.</p>
      </div>
      <div className="brutal bg-white shadow-chunk p-6 font-mono text-sm space-y-2">
        <p>▸ under construction</p>
        <p className="opacity-70">drop a PDF in /public and link it here, or render sections inline.</p>
        <a
          href="#"
          className="inline-block mt-2 glossy brutal bg-lime px-3 py-1.5 font-mono text-xs"
        >
          ⬇ download cv.pdf
        </a>
      </div>
    </div>
  );
}
