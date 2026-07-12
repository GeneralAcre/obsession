use anchor_lang::prelude::Pubkey as AnchorPubkey;
use anchor_lang::{AccountDeserialize, InstructionData};
use anchor_spl::token::spl_token::state::{Account as TokenAccountState, Mint as MintState};
use gacha_er::CardRecord;
use solana_program_option::COption;
use solana_program_pack::Pack;
use litesvm::LiteSVM;
use solana_address::Address;
use solana_instruction::{account_meta::AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

fn to_address(pk: AnchorPubkey) -> Address {
    Address::from(pk.to_bytes())
}

fn to_anchor(addr: Address) -> AnchorPubkey {
    AnchorPubkey::from(addr.to_bytes())
}

#[test]
fn mint_card_nft_creates_a_one_of_one_token() {
    let mut svm = LiteSVM::new();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();

    let program_id_anchor = gacha_er::ID;
    let program_id = to_address(program_id_anchor);
    svm.add_program_from_file(program_id, "../../target/deploy/gacha_er.so")
        .unwrap();

    let payer_key = to_anchor(payer.pubkey());
    let rarity: u8 = 2;
    let card_seed: u8 = 7;
    let pull_index: u32 = 1;
    let category: u8 = 1;

    let (mint_pda, _) = AnchorPubkey::find_program_address(
        &[
            gacha_er::CARD_MINT_SEED,
            payer_key.as_ref(),
            &pull_index.to_le_bytes(),
        ],
        &program_id_anchor,
    );
    let (card_record_pda, _) = AnchorPubkey::find_program_address(
        &[gacha_er::CARD_RECORD_SEED, mint_pda.as_ref()],
        &program_id_anchor,
    );
    let token_account_pda = anchor_spl::associated_token::get_associated_token_address(&payer_key, &mint_pda);

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(to_address(mint_pda), false),
            AccountMeta::new(to_address(card_record_pda), false),
            AccountMeta::new(to_address(token_account_pda), false),
            AccountMeta::new_readonly(to_address(anchor_spl::token::ID), false),
            AccountMeta::new_readonly(to_address(anchor_spl::associated_token::ID), false),
            AccountMeta::new_readonly(to_address(anchor_lang::solana_program::system_program::ID), false),
        ],
        data: gacha_er::instruction::MintCardNft {
            rarity,
            card_seed,
            pull_index,
            category,
        }
        .data(),
    };

    let blockhash = svm.latest_blockhash();
    let tx = Transaction::new(&[&payer], Message::new(&[ix], Some(&payer.pubkey())), blockhash);
    let meta = svm.send_transaction(tx).unwrap_or_else(|e| panic!("mint_card_nft failed: {e:?}"));
    assert!(meta.compute_units_consumed > 0);

    let mint_account = svm.get_account(&to_address(mint_pda)).expect("mint account should exist");
    let mint_state = MintState::unpack(&mint_account.data).expect("valid mint state");
    assert_eq!(mint_state.decimals, 0, "card NFTs must be indivisible");
    assert_eq!(mint_state.supply, 1, "supply must be fixed at exactly 1");
    assert_eq!(mint_state.mint_authority, COption::None, "mint authority must be revoked after minting");
    assert_eq!(
        mint_state.freeze_authority,
        COption::None,
        "freeze authority must be revoked too, or the program could freeze the NFT later"
    );

    let token_account = svm
        .get_account(&to_address(token_account_pda))
        .expect("token account should exist");
    let token_state = TokenAccountState::unpack(&token_account.data).expect("valid token account state");
    assert_eq!(token_state.amount, 1, "exactly one token should be minted");
    assert_eq!(token_state.mint, mint_pda);
    assert_eq!(token_state.owner, payer_key, "the puller should own the NFT");

    let record_account = svm
        .get_account(&to_address(card_record_pda))
        .expect("card record account should exist");
    let record = CardRecord::try_deserialize(&mut &record_account.data[..]).expect("valid card record");
    assert_eq!(record.mint, mint_pda);
    assert_eq!(record.rarity, rarity);
    assert_eq!(record.card_seed, card_seed);
    assert_eq!(record.pull_index, pull_index);
    assert_eq!(record.category, category);
}

#[test]
fn mint_card_nft_rejects_out_of_range_rarity() {
    let mut svm = LiteSVM::new();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();

    let program_id_anchor = gacha_er::ID;
    let program_id = to_address(program_id_anchor);
    svm.add_program_from_file(program_id, "../../target/deploy/gacha_er.so")
        .unwrap();

    let payer_key = to_anchor(payer.pubkey());
    let rarity: u8 = 3; // invalid: only 0, 1, 2 are valid rarities
    let card_seed: u8 = 0;
    let pull_index: u32 = 1;

    let (mint_pda, _) = AnchorPubkey::find_program_address(
        &[
            gacha_er::CARD_MINT_SEED,
            payer_key.as_ref(),
            &pull_index.to_le_bytes(),
        ],
        &program_id_anchor,
    );
    let (card_record_pda, _) = AnchorPubkey::find_program_address(
        &[gacha_er::CARD_RECORD_SEED, mint_pda.as_ref()],
        &program_id_anchor,
    );
    let token_account_pda = anchor_spl::associated_token::get_associated_token_address(&payer_key, &mint_pda);

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(to_address(mint_pda), false),
            AccountMeta::new(to_address(card_record_pda), false),
            AccountMeta::new(to_address(token_account_pda), false),
            AccountMeta::new_readonly(to_address(anchor_spl::token::ID), false),
            AccountMeta::new_readonly(to_address(anchor_spl::associated_token::ID), false),
            AccountMeta::new_readonly(to_address(anchor_lang::solana_program::system_program::ID), false),
        ],
        data: gacha_er::instruction::MintCardNft {
            rarity,
            card_seed,
            pull_index,
            category: 0,
        }
        .data(),
    };

    let blockhash = svm.latest_blockhash();
    let tx = Transaction::new(&[&payer], Message::new(&[ix], Some(&payer.pubkey())), blockhash);
    let result = svm.send_transaction(tx);
    assert!(result.is_err(), "an out-of-range rarity byte must be rejected");
}

#[test]
fn revoke_freeze_authority_clears_a_stale_freeze_authority() {
    let mut svm = LiteSVM::new();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();

    let program_id_anchor = gacha_er::ID;
    let program_id = to_address(program_id_anchor);
    svm.add_program_from_file(program_id, "../../target/deploy/gacha_er.so")
        .unwrap();

    let holder: AnchorPubkey = "11111111111111111111111111111112".parse().unwrap();
    let pull_index: u32 = 1;
    let (mint_pda, _) = AnchorPubkey::find_program_address(
        &[gacha_er::CARD_MINT_SEED, holder.as_ref(), &pull_index.to_le_bytes()],
        &program_id_anchor,
    );

    // Simulate a pre-fix mint: mint authority already revoked, but freeze authority still
    // pointed at the mint's own PDA, exactly like the cards minted before this fix shipped.
    let mint_state = MintState {
        mint_authority: COption::None,
        supply: 1,
        decimals: 0,
        is_initialized: true,
        freeze_authority: COption::Some(mint_pda),
    };
    let mut data = vec![0u8; MintState::LEN];
    MintState::pack(mint_state, &mut data).unwrap();
    svm.set_account(
        to_address(mint_pda),
        solana_account::Account {
            lamports: 1_461_600,
            data,
            owner: to_address(anchor_spl::token::ID),
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(to_address(mint_pda), false),
            AccountMeta::new_readonly(to_address(anchor_spl::token::ID), false),
        ],
        data: gacha_er::instruction::RevokeFreezeAuthority { holder, pull_index }.data(),
    };

    let blockhash = svm.latest_blockhash();
    let tx = Transaction::new(&[&payer], Message::new(&[ix], Some(&payer.pubkey())), blockhash);
    svm.send_transaction(tx)
        .unwrap_or_else(|e| panic!("revoke_freeze_authority failed: {e:?}"));

    let mint_account = svm.get_account(&to_address(mint_pda)).expect("mint account should exist");
    let mint_state = MintState::unpack(&mint_account.data).expect("valid mint state");
    assert_eq!(mint_state.freeze_authority, COption::None, "freeze authority should now be revoked");
}

#[test]
fn client_side_pda_derivation_matches_program() {
    // Cross-check against the exact same seeds the TS frontend derives client-side
    // (see PullScreen.tsx handleMint), using a fixed payer so both sides are reproducible.
    let payer_key: AnchorPubkey = "11111111111111111111111111111112".parse().unwrap();
    let pull_index: u32 = 1;

    let (mint_pda, _) = AnchorPubkey::find_program_address(
        &[gacha_er::CARD_MINT_SEED, payer_key.as_ref(), &pull_index.to_le_bytes()],
        &gacha_er::ID,
    );
    let (card_record_pda, _) = AnchorPubkey::find_program_address(
        &[gacha_er::CARD_RECORD_SEED, mint_pda.as_ref()],
        &gacha_er::ID,
    );
    let token_account_pda = anchor_spl::associated_token::get_associated_token_address(&payer_key, &mint_pda);

    assert_eq!(mint_pda.to_string(), "69FT21cM4Bhoh2C4ngnvNvdQMrAVzokamobSCZgvqEka");
    assert_eq!(card_record_pda.to_string(), "3WWgt4GYvZpGP5uJZotBCH4uh9dCuGMcQN2eydFPZQgp");
    assert_eq!(token_account_pda.to_string(), "4S44Synso7Umev2CPeyYqSMY2ow9Xed71TKNfttjaVqP");
}
