# Obsession

Obsession is a responsive, on-chain fortune-card gacha built on Solana. Choose a Life, Crypto, or Relationship pack, draw a rarity-ranked oracle card, and keep a session journal of your readings.

The app uses an Anchor program for its player state and MagicBlock's Ephemeral Rollup for fast draw resolution.

## Project structure

- `app/` — React, TypeScript, Vite, and Tailwind frontend.
- `programs/gacha-er/` — Anchor smart contract.
- `Anchor.toml` — Anchor workspace configuration.

## Run locally

### Frontend

```bash
cd app
npm install
npm run dev
```

The local Vite server will print its URL (normally `http://localhost:5173`).

### Solana program

Install Rust, the Solana CLI, and the Anchor CLI first. Then run:

```bash
anchor build
anchor test
```

## Frontend commands

Run these from `app/`:

```bash
npm run dev      # Start the development server
npm run build    # Type-check and create a production build
npm run preview  # Serve the production build locally
```

## Deployment

The frontend is configured to deploy to Vercel from the `app/` directory:

```bash
cd app
vercel --prod
```

Vercel uses `npm run build` and publishes the generated `dist/` directory. The on-chain program must be built and deployed separately with Anchor.

## Notes

- Wallet actions use Solana devnet and require a wallet-adapter compatible wallet.
- The app is for entertainment only; its readings are not financial, legal, medical, or relationship advice.
