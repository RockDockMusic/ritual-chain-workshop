# AIJudge — Commit-Reveal Bounty Specification

**Status:** implemented, tested (25/25), deployed and exercised on Ritual L1.
**Track:** Commit-Reveal (required).
**Chain:** Ritual L1, id `1979`.
**Frontend:** https://rockdockmusic.github.io/ritual-chain-workshop/

This document specifies the `AIJudge` contract: a sealed-bid bounty in which
answers are committed as hashes, revealed and verified after a deadline, judged
by a single batched LLM inference, and finalized by a human. It reads as a spec,
not a tutorial.

---

## 0. Glossary

| Term | Definition |
|------|------------|
| **Commitment** | `keccak256(answer, salt, sender, bountyId)` — the only thing stored during submission. |
| **Reveal** | Supplying `(answer, salt)` so the contract can recompute and verify the commitment. |
| **Eligible** | A submission whose reveal verified; the only kind that can be judged or win. |
| **Batch judging** | A single LLM call covering all eligible answers at once. Never one call per answer. |
| **Owner** | The address that created the bounty and funds/judges/finalizes it. |

---

## 1. Threat addressed

The starter contract stored answers in plaintext at submission time. This admits a
**front-running / copy attack**:

```
t0  A submits  "solar power"                      (visible on-chain)
t1  B reads A's answer, submits "solar power + storage"
t2  deadline; B wins with a derivative of A's idea
```

The submission phase must therefore reveal **zero information** about answer
contents. Hash commitments satisfy this: the preimage is computationally hidden,
so an observer at `t0..t1` learns nothing usable.

---

## 2. Commitment construction

```
commitment = keccak256(answer, salt, msg.sender, bountyId)
```

Binding rationale, field by field:

- `answer` — the payload; never transmitted until reveal.
- `salt` — caller-generated entropy; without it, a small answer space could be
  brute-forced from the hash.
- `msg.sender` — **anti-theft.** A copied commitment cannot be revealed by a
  different address; the recomputed hash diverges.
- `bountyId` — **anti-replay.** A commitment is scoped to one bounty.

Client and contract MUST hash identically. See `web/src/lib/*` for the client
side and `computeCommitment(...)` on-chain for parity.

---

## 3. State machine

```
            createBounty                 submitCommitment*               revealAnswer*
  (none) ───────────────▶ COMMIT ───────────────────────────▶ COMMIT ───────────────────▶ REVEAL
                            │  accepts commitments               │  (after submissionDeadline)
                            │  until submissionDeadline          ▼  accepts reveals until revealDeadline
                            │                                  REVEAL
                            │                                    │  judgeAll (owner, after revealDeadline)
                            ▼                                    ▼
                          JUDGED ◀───────────────────────────  JUDGING
                            │  finalizeWinner (owner)
                            ▼
                        FINALIZED
```

`*` = callable repeatedly by distinct participants within the window.

---

## 4. Interface

Required functions:

```solidity
function submitCommitment(uint256 bountyId, bytes32 commitment) external;
function revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt) external;
function judgeAll(uint256 bountyId, bytes calldata llmInput) external;
function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external;
```

Supporting:

```solidity
function createBounty(...) external payable;   // open + fund + set deadlines
function getBounty(uint256) external view;
function getSubmission(uint256, uint256) external view;
function computeCommitment(...) external pure;
```

---

## 5. Invariants

| # | Invariant | Enforced by |
|---|-----------|-------------|
| I1 | A commitment is accepted only while `now < submissionDeadline`. | window check |
| I2 | At most one commitment per `(bountyId, address)`. | per-sender slot |
| I3 | A reveal is accepted only while `submissionDeadline ≤ now < revealDeadline`. | window check |
| I4 | A reveal succeeds iff the recomputed hash equals the stored commitment. | hash compare |
| I5 | Only eligible (revealed) submissions may be judged or finalized. | eligibility flag |
| I6 | `judgeAll` runs only after `revealDeadline`. | window check |
| I7 | `finalizeWinner` is owner-only and requires a prior `judgeAll`. | access + phase check |
| I8 | The reward is paid once, to a single winner, then zeroed. | payout guard |

Each invariant has at least one corresponding negative test in
`hardhat/contracts/AIJudge.t.sol` (25 tests total).

---

## 6. Judging path

`judgeAll(bountyId, llmInput)` performs **one** inference over the entire eligible
set. The client assembles all revealed answers into a single prompt, encodes the
Ritual LLM request, and passes it as `llmInput`. On Ritual the call hits the LLM
precompile (`0x0802`, model GLM-4.7-FP8); the verdict is stored on-chain as
`aiReview` in the form `{ "winnerIndex": n, "summary": "…" }`.

The model's output is **advisory**. `finalizeWinner` requires a human owner to
ratify (or override) the recommendation before any funds move.

---

## 7. Ritual L1 operational constraints

| Constraint | Value / handling |
|------------|------------------|
| `block.timestamp` unit | **milliseconds** (not seconds). All deadlines computed in ms. |
| `judgeAll` gas | **pinned to 6,000,000.** Async settlement (~1.09M gas) exceeds the auto-estimate, which only covers the first pass. |
| LLM escrow | prepaid RITUAL in `RitualWallet` `0x532F0dF0…`, worst-case ≈ 0.311 RITUAL, lock must outlive the async callback. |
| Portability | On non-Ritual EVM chains, pass empty `llmInput`; the lifecycle still completes and the verdict reference is recorded off-chain. |

---

## 8. Deployment record

```
network    Ritual L1 (id 1979)
contract   0x47CcF584DB2482B2A339945BC34E0368317CBFEF
deploy tx  0x7020852509782efea1da7d65a44684b770e1b7b02a3222b312acbeb599b6bbe6
```

A complete `createBounty → submitCommitment → revealAnswer → judgeAll →
finalizeWinner` cycle was executed on the live network, with each call landing in
its correct time window. During the commit phase `getSubmission` returns an empty
`answer`; it is populated only after a verified reveal — direct evidence that
contents stay hidden until reveal.

Explorer: https://explorer.ritualfoundation.org/address/0x47CcF584DB2482B2A339945BC34E0368317CBFEF

---

## 9. Build & test

```bash
cd hardhat
npm install
npx hardhat test solidity
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual
```

---

## 10. Supplementary documents

- `docs/TEST_PLAN.md` — enumerated reveal cases (valid, wrong answer, wrong salt,
  wrong sender, double reveal, late reveal).
- `docs/ARCHITECTURE.md` — commit-reveal vs. Ritual-native TEE judging.
- `docs/REFLECTION.md` — design notes.

---

## 11. Source tree

```
hardhat/contracts/AIJudge.sol      contract under specification
hardhat/contracts/AIJudge.t.sol    25 tests
web/                               frontend
docs/                              test plan · architecture · reflection
```
