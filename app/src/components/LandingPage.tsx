export function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative flex min-h-svh w-full items-end justify-center overflow-hidden bg-ink px-5 py-10 sm:px-8 sm:py-14">
      <div className="absolute inset-0">
        <img
          src="/obsession-landing.png"
          alt="A mystic reading a crystal ball beneath the stars"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/10 via-transparent to-ink/85" aria-hidden="true" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-xl text-center text-paper [text-shadow:3px_3px_0_#201839]">
        <h1 className="text-6xl font-black uppercase leading-[0.86] sm:text-8xl">Obsession</h1>
        <p className="mx-auto mt-6 max-w-md text-base font-medium leading-relaxed sm:text-lg">A card reading for the question you cannot stop thinking about.</p>
        <button
          type="button"
          onClick={onStart}
          className="mt-8 border-4 border-paper bg-flare px-8 py-4 text-sm font-black uppercase tracking-[0.16em] text-ink shadow-[4px_4px_0_#201839] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-paper focus-visible:outline-offset-4 active:translate-y-1"
        >
          Start
        </button>
      </div>
    </section>
  )
}
