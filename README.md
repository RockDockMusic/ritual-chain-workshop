# Privacy-Preserving AI Bounty Judge

A commit-reveal bounty judge for Ritual Chain. Answers stay **hidden behind a
cryptographic hash** while submissions are open, so nobody can copy another
participant's idea. After the deadline, answers are revealed and verified, an AI
judges them all together in one batch, and a human owner pays the winner.

> **Live demo:** https://rockdockmusic.github.io/ritual-chain-workshop/
> (connect a wallet on Ritual Chain, id 1979)

> **Required Track (Commit-Reveal) — fully implemented and tested (25 passing tests).**
> Built on top of the Ritual workshop starter. The contract lives in
> [`hardhat/contracts/AIJudge.sol`](hardhat/contracts/AIJudge.sol).

### Deliverables (assignment checklist)

| Deliverable | Where |
|-------------|-------|
| ✅ Updated Solidity contract | [`hardhat/contracts/AIJudge.sol`](hardhat/contracts/AIJudge.sol) |
| ✅ README explaining the lifecycle | **this file** |
| ✅ Test plan for reveal cases | [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) |
| ✅ Architecture note | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| ✅ Reflection (5–8 sentences) | [`docs/REFLECTION.md`](docs/REFLECTION.md) |

---

## 1. The problem we're fixing

In the original workshop version, an answer became **public the instant it was
submitted**. That created an unfair race:

> Alice submits *"use solar power"*. Bob reads it, submits *"use solar power **plus
> battery storage**"*, and wins. Bob never had a better idea — he just got to see
> Alice's first.

In a winner-takes-all bounty, letting people read each other's answers before the
deadline destroys fairness. **The goal: keep answers hidden until judging.**

---

## 2. The solution: commit-reveal

The trick is to never put the answer on-chain during the submission phase — only
an irreversible **fingerprint** (a hash) of it.

```
commitment = keccak256(answer, salt, msg.sender, bountyId)
```

- `answer` — your real submission
- `salt` — a random secret number you keep
- `msg.sender` — your address (binds the commitment to you)
- `bountyId` — which bounty it's for

You can't go from the hash back to the answer, so others see only noise. Later you
prove the answer was yours all along by re-supplying `answer + salt`; the contract
recomputes the hash and checks it matches.

**Why include `msg.sender` and `bountyId`?**
- `msg.sender` stops *reveal-theft*: Bob can't copy Alice's commitment hash and
  reveal it under his own address, because the hash is tied to Alice's address.
- `bountyId` stops *replay*: the same commitment can't be reused across bounties.

---

## 3. Lifecycle (the full flow)

```
  createBounty ─▶ submitCommitment ─▶ revealAnswer ─▶ judgeAll ─▶ finalizeWinner
   ─────────────   ──────────────────   ─────────────   ─────────   ──────────────
   owner funds      only the hash        prove answer    one batch   human owner
   reward + sets    goes on-chain        with salt;      LLM call    picks winner;
   two deadlines    (answer hidden)      hash verified   over all    reward paid
                                                          revealed
   [before submissionDeadline] [submission→reveal window] [after revealDeadline]
```

A worked example with the same characters:

1. **createBounty** — Owner opens *"Best startup idea"* with 5 RITUAL reward, a
   submission deadline (1h) and a reveal deadline (2h).
2. **submitCommitment** — Alice computes `keccak256("solar power", salt, alice, 1)`
   and submits only that hash. Bob sees the hash but **cannot read "solar power"**,
   so he can't copy it. Bob commits his own idea blind.
3. **revealAnswer** — After the submission deadline, Alice calls
   `revealAnswer(1, "solar power", salt)`. The contract recomputes the hash and
   confirms it matches → her answer is now public and **eligible**. (Wrong answer,
   wrong salt, or wrong sender → rejected.)
4. **judgeAll** — After the reveal deadline, the owner sends **all revealed answers
   in one batch** to the Ritual LLM precompile (`0x0802`). The AI returns a
   recommended ranking. (Never one LLM call per answer.)
5. **finalizeWinner** — The owner reviews the AI's recommendation and calls
   `finalizeWinner(1, winnerIndex)`. The reward is paid to that revealed entry.
   **The AI only recommends; a human makes the final call.**

---

## 4. Required functions (exact signatures)

```solidity
function submitCommitment(uint256 bountyId, bytes32 commitment) external;
function revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt) external;
function judgeAll(uint256 bountyId, bytes calldata llmInput) external;
function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external;
```

(Plus `createBounty(...)` to open a bounty and helper views like `getBounty`,
`getSubmission`, and `computeCommitment`.)

---

## 5. Rules the contract enforces

| Rule | Why it matters |
|------|----------------|
| Commit only **before** the submission deadline | the window must close before anyone reveals |
| One commitment per address per bounty | no spamming / no multiple shots |
| Reveal only in `[submissionDeadline, revealDeadline)` | reveals happen after submissions are locked |
| Reveal valid **only if the hash matches** | proves you didn't change your answer |
| Unrevealed submissions are **ineligible** | can't win without proving your entry |
| Judge only **after** the reveal deadline | the AI sees the full, final field |
| Finalize only **after** judging, owner-only | a human owns the payout decision |
| Only one winner is paid | winner-takes-all, reward zeroed after payout |

---

## 6. How to run it

```bash
cd hardhat
npm install
npx hardhat test solidity     # 25 tests: valid + invalid reveal cases
```

Deploy (Ritual L1 or any EVM chain):

```bash
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual
```

**Portability:** the contract works on **any EVM chain**. On a non-Ritual chain
the LLM precompile has no code, so you pass an empty `llmInput` to `judgeAll` and
record the verdict reference off-chain via `setVerdictReference`. On Ritual, you
build the batch LLM request off-chain and pass it as `llmInput`.

> ⚠️ **Ritual note:** Ritual's `block.timestamp` is in **milliseconds** (not
> seconds like a standard EVM chain). Choose your deadlines accordingly when
> interacting with a live Ritual node.

---

## 7. A note on privacy (commit-reveal vs Ritual-native)

Commit-reveal keeps answers hidden **during submission**, but they become public
**at reveal time** (before the AI judges). That's enough to stop copying, because
the submission window is already closed. If you need answers to stay secret *even
through judging*, the **Advanced Track** uses Ritual's TEE to decrypt and batch-judge
encrypted answers privately — designed in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 8. Live deployment & on-chain proof (Ritual Chain, id 1979)

The contract is deployed and a full bounty lifecycle — including a **real Ritual
LLM judging call** — was executed on the live Ritual network. Every phase ran in
its correct time window.

**Contract:** [`0x47CcF584DB2482B2A339945BC34E0368317CBFEF`](https://explorer.ritualfoundation.org/address/0x47CcF584DB2482B2A339945BC34E0368317CBFEF)
**Deploy tx:** [`0x70208525…99b6bbe6`](https://explorer.ritualfoundation.org/tx/0x7020852509782efea1da7d65a44684b770e1b7b02a3222b312acbeb599b6bbe6)

The bounty uses two deadlines (Ritual `block.timestamp` is in **milliseconds**).
A full commit → reveal → judge → finalize cycle was run end-to-end through the
front-end:

- `createBounty` opens the bounty, funds the reward, sets both deadlines.
- `submitCommitment` posts only the commitment hash — the answer stays hidden.
- `revealAnswer` reveals (answer, salt); the contract recomputes and verifies the hash.
- `judgeAll` sends one batched request to the Ritual LLM precompile (`0x0802`).
  The GLM-4.7 model returned a real verdict that is stored on-chain as `aiReview`,
  e.g. `{"winnerIndex": 0, "summary": "The submission clearly defines the product
  as an AI copilot…"}`. **The judge tx pins a 6,000,000 gas limit** so the async
  settlement (which decodes the LLM response and writes it to storage, ~1.09M gas)
  does not run out of gas mid-replay.
- `finalizeWinner` lets the human owner ratify the winner and pays the reward.

**Deadline rules are respected end-to-end:** the commitment lands before the
submission deadline, the reveal happens strictly inside the reveal window, and
judging + finalization only happen after the reveal deadline. During the
submission phase `getSubmission` returns an empty `answer`; it only becomes the
revealed text after a valid reveal — proving the answer stays hidden until reveal.

> Funding note: `judgeAll` with a live LLM call requires prepaid RITUAL locked in
> the `RitualWallet` (`0x532F0dF0…`). The LLM precompile's worst-case escrow is
> ~0.311 RITUAL (refundable); the front-end deposits a margin above that before
> judging and the lock must outlive the async callback.

## Repo layout


```
/hardhat   -> Solidity contract (AIJudge.sol), tests (AIJudge.t.sol), deploy module
/web       -> frontend starter (unchanged)
/docs      -> test plan, architecture note, reflection
```
