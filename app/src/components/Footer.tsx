function FooterHeading({ children }: { children: string }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.2em] text-paper/45">{children}</p>
}

function FooterLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="block text-left text-sm font-bold text-paper/80 hover:text-flare">
      {children}
    </button>
  )
}

export function Footer({
  onHome,
  onDraw,
  onCollection,
  onProfile,
  onFaq,
  onPrivacy,
  onTerms,
}: {
  onHome: () => void
  onDraw: () => void
  onCollection: () => void
  onProfile: () => void
  onFaq: () => void
  onPrivacy: () => void
  onTerms: () => void
}) {
  return (
    <footer className="border-t-4 border-ink bg-ink text-paper pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-[2fr_1fr_1fr] md:px-6">
        <div>
          <FooterHeading>Contact &amp; support</FooterHeading>
          <form onSubmit={(event) => event.preventDefault()} className="mt-4 flex flex-col gap-4">
            <input
              type="text"
              placeholder="name"
              className="border-b-2 border-paper/20 bg-transparent pb-2 text-sm text-paper placeholder:text-paper/40 focus:border-flare focus:outline-none"
            />
            <input
              type="email"
              placeholder="email"
              className="border-b-2 border-paper/20 bg-transparent pb-2 text-sm text-paper placeholder:text-paper/40 focus:border-flare focus:outline-none"
            />
            <textarea
              placeholder="message"
              rows={2}
              className="resize-none border-b-2 border-paper/20 bg-transparent pb-2 text-sm text-paper placeholder:text-paper/40 focus:border-flare focus:outline-none"
            />
            <button type="submit" className="mt-1 w-full max-w-xs rounded-none border-4 border-paper bg-flare px-4 py-3 text-xs font-black uppercase tracking-widest text-ink">
              Send
            </button>
          </form>
        </div>

        <div>
          <FooterHeading>Navigation</FooterHeading>
          <div className="mt-4 flex flex-col gap-3">
            <FooterLink onClick={onHome}>Home</FooterLink>
            <FooterLink onClick={onDraw}>Draw</FooterLink>
            <FooterLink onClick={onCollection}>Collection</FooterLink>
            <FooterLink onClick={onProfile}>Profile</FooterLink>
          </div>
        </div>

        <div>
          <FooterHeading>Legal</FooterHeading>
          <div className="mt-4 flex flex-col gap-3">
            <FooterLink onClick={onFaq}>FAQ</FooterLink>
            <FooterLink onClick={onPrivacy}>Privacy Policy</FooterLink>
            <FooterLink onClick={onTerms}>Terms of Use</FooterLink>
          </div>
        </div>
      </div>

      <div className="border-t-2 border-paper/10 px-4 py-8 md:px-6">
        <p className="mx-auto max-w-xl text-center text-xs leading-6 text-paper/50 sm:text-sm">
          Obsession is a fully on-chain fortune-card gacha on Solana — draw sealed cards, follow your reading, and grow your collection.
          For entertainment only. Not financial, legal, or relationship advice.
        </p>
        <div className="mx-auto mt-5 flex w-fit items-center gap-2 border-2 border-paper/25 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-paper/60">
          <span>Powered by</span>
          <img src="/MagicBlock-Logo-White.png" alt="MagicBlock" className="h-4 w-auto" />
        </div>
      </div>
    </footer>
  )
}
