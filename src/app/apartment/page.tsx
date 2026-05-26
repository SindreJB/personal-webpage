export default function ApartmentPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 pt-12 pb-20">
      <div className="brutal bg-sunset shadow-chunk-lg p-6 mb-8">
        <p className="font-mono text-xs bg-white brutal inline-block px-2 py-0.5 shadow-chunk-sm">/apartment</p>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">new apartment 🏠</h1>
        <p className="mt-3 font-body">moodboards, floorplans, 3D experiments. mostly chaos for now.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <section className="brutal bg-white shadow-chunk p-5">
          <h2 className="font-display text-3xl mb-2">floorplan</h2>
          <div className="aspect-square bg-chrome-100 brutal flex items-center justify-center font-mono text-xs text-chrome-500">
            drop floorplan.png in /public
          </div>
        </section>
        <section className="brutal bg-white shadow-chunk p-5">
          <h2 className="font-display text-3xl mb-2">moodboard</h2>
          <div className="aspect-square brutal bg-grid-light bg-[length:20px_20px] flex items-center justify-center font-mono text-xs text-chrome-500">
            add image grid here
          </div>
        </section>
        <section className="brutal bg-white shadow-chunk p-5">
          <h2 className="font-display text-3xl mb-2">3D view</h2>
          <div className="aspect-square bg-chrome-900 text-lime brutal flex items-center justify-center font-mono text-xs">
            embed three.js / spline iframe
          </div>
          <p className="font-mono text-xs mt-3 opacity-70">
            for the 3D design: try Spline (free, easy embed) or react-three-fiber if you want
            full control.
          </p>
        </section>
      </div>

      <div className="brutal bg-cyber shadow-chunk p-5 mt-6 font-mono text-xs">
        <p>▸ build notes</p>
        <ul className="list-disc list-inside mt-2 space-y-1 opacity-80">
          <li>plan: living room, kitchen, bedroom, office nook</li>
          <li>palette: warm neutrals + one electric accent</li>
          <li>budget tracker → maybe pull from supabase later</li>
        </ul>
      </div>
    </div>
  );
}
