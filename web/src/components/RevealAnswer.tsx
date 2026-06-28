"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useNow } from "@/hooks/useNow";
import aiJudgeAbi from "@/abi/AIJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canReveal, computeCommitment, recallCommitment, type Bounty } from "@/lib/bounty";
import { useWriteTx } from "@/hooks/useWriteTx";
import { Card, CardHeader, CardBody, Field, Textarea, Input, Button, TxStatus, Notice } from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

/**
 * Act II — Reveal. Provide answer + salt; the contract recomputes the hash and
 * verifies it matches your commitment. A live preview shows whether they match.
 */
export function RevealAnswer({
  bountyId,
  bounty,
  onRevealed,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onRevealed: () => void;
}) {
  const { address, isConnected } = useAccount();
  // Track whether the user has manually edited each field. Until they do, the
  // field shows the locally-stored commitment value. This is robust to mount
  // ordering / wallet hydration: as soon as `address` is available the stored
  // value is reflected, without relying on a one-shot effect.
  const [answerEdit, setAnswerEdit] = useState<string | null>(null);
  const [saltEdit, setSaltEdit] = useState<string | null>(null);
  const now = useNow();
  const tx = useWriteTx(() => onRevealed());

  const stored = address ? recallCommitment(bountyId, address) : null;
  const answer = answerEdit ?? stored?.answer ?? "";
  const salt = saltEdit ?? stored?.salt ?? "";

  // Read this participant's on-chain commitment so we can warn BEFORE spending
  // gas on a reveal that would revert with "commitment mismatch".
  const slotQ = useReadContract({
    address: contractAddress,
    abi: aiJudgeAbi,
    functionName: "commitmentSlot",
    args: address ? [bountyId, address] : undefined,
    chainId: ritualChain.id,
    query: { enabled: Boolean(address) },
  });
  const slot = slotQ.data as bigint | undefined;
  const subQ = useReadContract({
    address: contractAddress,
    abi: aiJudgeAbi,
    functionName: "getSubmission",
    args: slot && slot > 0n ? [bountyId, slot - 1n] : undefined,
    chainId: ritualChain.id,
    query: { enabled: Boolean(slot && slot > 0n) },
  });

  if (!canReveal(bounty, now)) return null;

  const validSalt = /^0x[0-9a-fA-F]{64}$/.test(salt);
  const preview =
    address && answer && validSalt
      ? computeCommitment(answer.trim(), salt as `0x${string}`, address, bountyId)
      : null;

  const onChainCommitment = subQ.data ? ((subQ.data as readonly unknown[])[1] as `0x${string}`) : undefined;
  const matches =
    preview && onChainCommitment ? preview.toLowerCase() === onChainCommitment.toLowerCase() : null;

  async function handleReveal(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !validSalt || !contractAddress) return;
    try {
      await tx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "revealAnswer",
        args: [bountyId, answer.trim(), salt as `0x${string}`],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Act II · Reveal your answer"
        subtitle="The contract verifies keccak256(answer, salt, you, bountyId) against your commitment."
      />
      <CardBody>
        <form onSubmit={handleReveal} className="space-y-3">
          {stored ? (
            <Notice tone="green">
              Found your saved commitment for this bounty in this browser — answer and salt are
              filled in below.
            </Notice>
          ) : (
            <Notice tone="amber">
              No saved commitment found in this browser for the connected wallet. If you committed
              elsewhere, paste your answer and salt manually.
            </Notice>
          )}
          <Field label="Answer">
            <Textarea value={answer} onChange={(e) => setAnswerEdit(e.target.value)} rows={4} />
          </Field>
          <Field label="Salt" hint="Auto-filled if you committed in this browser.">
            <Input value={salt} onChange={(e) => setSaltEdit(e.target.value)} placeholder="0x…" />
          </Field>

          {preview ? (
            <Notice tone={matches === false ? "amber" : "zinc"}>
              <div className="font-mono text-[11px] break-all">computed: {preview}</div>
              {onChainCommitment ? (
                <div className="mt-1 font-mono text-[11px] break-all opacity-70">
                  on-chain: {onChainCommitment}
                </div>
              ) : null}
              {matches === false ? (
                <div className="mt-2 text-amber-300">
                  This answer + salt does NOT match your on-chain commitment. Revealing now would
                  revert (commitment mismatch). Use the exact answer and salt you committed with.
                </div>
              ) : null}
              {matches === true ? (
                <div className="mt-2 text-green-400">Matches your on-chain commitment ✓</div>
              ) : null}
            </Notice>
          ) : null}

          <Button
            type="submit"
            disabled={!isConnected || !answer.trim() || !validSalt || matches === false || tx.isBusy}
            className="w-full"
          >
            {tx.isBusy ? "Revealing…" : "Open the mask (reveal)"}
          </Button>
          {!isConnected && <p className="text-xs text-zinc-500">Connect your wallet to reveal.</p>}
          {!validSalt && salt ? (
            <p className="text-xs text-amber-300">Salt must be a 32-byte hex value (0x + 64 chars).</p>
          ) : null}
          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />
        </form>
      </CardBody>
    </Card>
  );
}
