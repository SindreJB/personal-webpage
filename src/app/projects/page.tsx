export default function ProjectsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-12 pb-20">
      <div className="brutal bg-cyber shadow-chunk-lg p-6 mb-8">
        <p className="font-mono text-xs bg-white brutal inline-block px-2 py-0.5 shadow-chunk-sm">/projects</p>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">side projects 💾</h1>
        <p className="mt-3 font-body">things I built. some work. some used to.</p>
      </div>
      <div className="brutal bg-white shadow-chunk p-6 font-mono text-sm">
        <p className="mb-2">▸ under construction</p>
        <p className="opacity-70">
          drop project cards here — each one a chunky tile with screenshot, stack tags, github link.
          easy to add later: this is a static page, just dump JSX.
        </p>
      </div>
    </div>
  );
}
