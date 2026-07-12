use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, spl_token::instruction::AuthorityType, Mint, MintTo, SetAuthority, Token, TokenAccount};
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_high_priority_scoped_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use ephemeral_rollups_sdk::anchor::{delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;

declare_id!("4re47fFt4ty2BkNS9NuhBUqDSbGZYhydkt42f4c9E7zv");

pub const PLAYER_SEED: &[u8] = b"player";
pub const CARD_MINT_SEED: &[u8] = b"card_mint";
pub const CARD_RECORD_SEED: &[u8] = b"card_record";

// Pull the pity lever after this many pulls without a Legendary
pub const PITY_THRESHOLD: u32 = 50;

#[ephemeral]
#[program]
pub mod gacha_er {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        player.pulls_done = 0;
        player.pulls_since_legendary = 0;
        player.last_rarity = 0;
        player.last_card_seed = 0;
        msg!("Player initialized: {:?}", ctx.accounts.payer.key());
        Ok(())
    }

    /// Delegate this player's PDA to the Ephemeral Rollup for instant, fee-free pulls.
    /// Called once on the base layer before a player's first pull.
    pub fn delegate_player(ctx: Context<DelegateInput>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[PLAYER_SEED, ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                // Optionally pin a specific ER validator via remaining_accounts[0]
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Request randomness for a pull. Send this to the ER once delegated.
    /// Resolves via callback below.
    pub fn pull_gacha(ctx: Context<PullGachaCtx>, client_seed: u8) -> Result<()> {
        msg!("Requesting VRF randomness for pull...");
        let ix = create_request_high_priority_scoped_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: ID,
            callback_discriminator: instruction::CallbackPullGacha::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: ctx.accounts.player.key(),
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// Consumes VRF randomness, resolves rarity + card seed, applies pity logic.
    pub fn callback_pull_gacha(
        ctx: Context<CallbackPullGachaCtx>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let player = &mut ctx.accounts.player;

        // Byte 0 decides rarity tier, byte 1 decides which card within that tier
        let rarity_roll = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 1, 100);
        let card_seed = randomness[1];

        let rarity = resolve_rarity(rarity_roll, player.pulls_since_legendary);

        player.pulls_since_legendary = next_pulls_since_legendary(rarity, player.pulls_since_legendary);
        player.pulls_done = player.pulls_done.saturating_add(1);
        player.last_rarity = rarity;
        player.last_card_seed = card_seed;

        msg!(
            "Pull #{} -> rarity: {}, card_seed: {}",
            player.pulls_done,
            rarity,
            card_seed
        );

        Ok(())
    }

    /// Mints the most recently pulled card as a real, wallet-visible NFT on the base layer:
    /// a fresh 0-decimal mint with a fixed supply of 1 (mint authority revoked right after
    /// minting), plus a small on-chain record of which rarity/seed it represents. Runs on the
    /// base layer (not the ER) so the token is durable and shows up in any Solana wallet,
    /// including on Seeker.
    pub fn mint_card_nft(
        ctx: Context<MintCardNft>,
        rarity: u8,
        card_seed: u8,
        pull_index: u32,
    ) -> Result<()> {
        require!(rarity <= 2, GachaError::InvalidRarity);

        let record = &mut ctx.accounts.card_record;
        record.mint = ctx.accounts.mint.key();
        record.rarity = rarity;
        record.card_seed = card_seed;
        record.pull_index = pull_index;

        let payer_key = ctx.accounts.payer.key();
        let pull_index_bytes = pull_index.to_le_bytes();
        let mint_bump = ctx.bumps.mint;
        let mint_seeds: &[&[u8]] = &[
            CARD_MINT_SEED,
            payer_key.as_ref(),
            &pull_index_bytes,
            &[mint_bump],
        ];
        let signer_seeds: &[&[&[u8]]] = &[mint_seeds];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.mint.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // Fix the supply at exactly 1 by giving up mint authority — this is what makes it an NFT.
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SetAuthority {
                    current_authority: ctx.accounts.mint.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                signer_seeds,
            ),
            AuthorityType::MintTokens,
            None,
        )?;

        Ok(())
    }
}

#[error_code]
pub enum GachaError {
    #[msg("Rarity byte must be 0 (Common), 1 (Rare), or 2 (Legendary)")]
    InvalidRarity,
}

/// 0 = Common, 1 = Rare, 2 = Legendary.
/// `rarity_roll` is expected in `1..=100` (the VRF is sampled with that inclusive range).
/// Pity forces a Legendary once `pulls_since_legendary` has reached `PITY_THRESHOLD`,
/// regardless of the roll.
fn resolve_rarity(rarity_roll: u8, pulls_since_legendary: u32) -> u8 {
    if pulls_since_legendary >= PITY_THRESHOLD {
        return 2;
    }
    if rarity_roll <= 60 {
        0
    } else if rarity_roll <= 90 {
        1
    } else {
        2
    }
}

/// Legendary pulls reset the pity counter; anything else advances it.
fn next_pulls_since_legendary(rarity: u8, pulls_since_legendary: u32) -> u32 {
    if rarity == 2 {
        0
    } else {
        pulls_since_legendary.saturating_add(1)
    }
}

#[cfg(test)]
mod pull_logic_tests {
    use super::*;

    #[test]
    fn common_tier_covers_1_through_60() {
        assert_eq!(resolve_rarity(1, 0), 0);
        assert_eq!(resolve_rarity(60, 0), 0);
    }

    #[test]
    fn rare_tier_covers_61_through_90() {
        assert_eq!(resolve_rarity(61, 0), 1);
        assert_eq!(resolve_rarity(90, 0), 1);
    }

    #[test]
    fn legendary_tier_covers_91_through_100() {
        assert_eq!(resolve_rarity(91, 0), 2);
        assert_eq!(resolve_rarity(100, 0), 2);
    }

    #[test]
    fn pity_forces_legendary_at_threshold_regardless_of_roll() {
        // A roll that would normally be Common is overridden once pity is due.
        assert_eq!(resolve_rarity(1, PITY_THRESHOLD), 2);
        assert_eq!(resolve_rarity(1, PITY_THRESHOLD + 5), 2);
    }

    #[test]
    fn pity_does_not_trigger_one_pull_early() {
        assert_eq!(resolve_rarity(1, PITY_THRESHOLD - 1), 0);
    }

    #[test]
    fn legendary_pull_resets_pity_counter() {
        assert_eq!(next_pulls_since_legendary(2, 49), 0);
    }

    #[test]
    fn non_legendary_pull_increments_pity_counter() {
        assert_eq!(next_pulls_since_legendary(0, 5), 6);
        assert_eq!(next_pulls_since_legendary(1, 5), 6);
    }

    #[test]
    fn pity_counter_saturates_instead_of_overflowing() {
        assert_eq!(next_pulls_since_legendary(0, u32::MAX), u32::MAX);
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Player::INIT_SPACE,
        seeds = [PLAYER_SEED, payer.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    pub system_program: Program<'info, System>,
}

/// Accounts context for delegating the player PDA to the Ephemeral Rollup.
/// The #[delegate] macro injects the buffer/record/metadata/delegation_program
/// accounts needed by delegate_pda().
#[delegate]
#[derive(Accounts)]
pub struct DelegateInput<'info> {
    pub payer: Signer<'info>,
    /// CHECK: the player PDA being delegated
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
}

#[vrf]
#[derive(Accounts)]
pub struct PullGachaCtx<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, payer.key().as_ref()], bump)]
    pub player: Account<'info, Player>,
    /// CHECK: this instruction only ever runs on the ER (after delegation), so it must use
    /// the ephemeral queue — it's pre-delegated to the delegation program on the base layer,
    /// unlike DEFAULT_QUEUE, so the ER will actually let a pull's fee payer touch it.
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_EPHEMERAL_QUEUE)]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CallbackPullGachaCtx<'info> {
    /// CHECK: enforces this callback is invoked via CPI by the VRF program, scoped to this
    /// program specifically — the legacy global VRF_PROGRAM_IDENTITY is deprecated and the
    /// live oracle fulfiller no longer signs callbacks with it.
    #[account(address = ephemeral_vrf_sdk::consts::scoped_vrf_identity(&crate::ID))]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub player: Account<'info, Player>,
}

#[account]
#[derive(InitSpace)]
pub struct Player {
    pub pulls_done: u32,
    pub pulls_since_legendary: u32,
    pub last_rarity: u8,
    pub last_card_seed: u8,
}

#[derive(Accounts)]
#[instruction(rarity: u8, card_seed: u8, pull_index: u32)]
pub struct MintCardNft<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// A brand-new, one-off mint: 0 decimals, mint authority is the PDA itself so this
    /// instruction can sign for it once and then revoke minting forever.
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = mint,
        mint::freeze_authority = mint,
        seeds = [CARD_MINT_SEED, payer.key().as_ref(), &pull_index.to_le_bytes()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// The rarity/seed this specific mint represents — the on-chain "trait data" for the card,
    /// kept separately since we skip full Metaplex metadata for now.
    #[account(
        init,
        payer = payer,
        space = 8 + CardRecord::INIT_SPACE,
        seeds = [CARD_RECORD_SEED, mint.key().as_ref()],
        bump,
    )]
    pub card_record: Account<'info, CardRecord>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct CardRecord {
    pub mint: Pubkey,
    pub rarity: u8,
    pub card_seed: u8,
    pub pull_index: u32,
}
