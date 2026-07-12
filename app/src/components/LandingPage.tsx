export function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative flex min-h-svh w-full items-end justify-center overflow-hidden bg-ink px-5 py-10 md:px-8 md:py-14">
      <div className="absolute inset-0">
        <img
          src="/obsession-landing.png"
          alt="A mystic reading a crystal ball beneath the stars"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/10 via-transparent to-ink/85" aria-hidden="true" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-xl text-center text-paper [text-shadow:3px_3px_0_#201839]">
        <h1 className="text-5xl font-black uppercase leading-[0.92] sm:text-6xl md:text-7xl lg:text-8xl">Obsession</h1>
        <p className="mx-auto mt-6 max-w-md text-sm font-medium leading-relaxed sm:text-base lg:text-lg">
          A card reading for the question you cannot stop thinking about.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-8 rounded-none border-4 border-paper bg-flare px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-ink shadow-[4px_4px_0_#201839] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-paper focus-visible:outline-offset-4 active:translate-y-1 sm:px-8 sm:py-4"
        >
          Start
        </button>
      </div>
    </section>
  )
}
