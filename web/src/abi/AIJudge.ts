// ABI for the commit-reveal AIJudge (privacy-preserving bounty judge).
const abi = [
  // ---- public getters ----
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "commitmentSlot",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ---- events ----
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "bountyId", type: "uint256" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "string", name: "title", type: "string" },
      { indexed: false, internalType: "uint256", name: "reward", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "submissionDeadline", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "revealDeadline", type: "uint256" },
    ],
    name: "BountyCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "bountyId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "submissionIndex", type: "uint256" },
      { indexed: true, internalType: "address", name: "submitter", type: "address" },
      { indexed: false, internalType: "bytes32", name: "commitment", type: "bytes32" },
    ],
    name: "CommitmentSubmitted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "bountyId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "submissionIndex", type: "uint256" },
      { indexed: true, internalType: "address", name: "submitter", type: "address" },
    ],
    name: "AnswerRevealed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "bountyId", type: "uint256" },
      { indexed: false, internalType: "bytes", name: "aiReview", type: "bytes" },
    ],
    name: "AllAnswersJudged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "bountyId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "winnerIndex", type: "uint256" },
      { indexed: true, internalType: "address", name: "winner", type: "address" },
      { indexed: false, internalType: "uint256", name: "reward", type: "uint256" },
    ],
    name: "WinnerFinalized",
    type: "event",
  },

  // ---- constants ----
  {
    inputs: [],
    name: "MAX_ANSWER_LENGTH",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_SUBMISSIONS",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextBountyId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // ---- create ----
  {
    inputs: [
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "rubric", type: "string" },
      { internalType: "uint256", name: "submissionDeadline", type: "uint256" },
      { internalType: "uint256", name: "revealDeadline", type: "uint256" },
    ],
    name: "createBounty",
    outputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },

  // ---- commit-reveal ----
  {
    inputs: [
      { internalType: "uint256", name: "bountyId", type: "uint256" },
      { internalType: "bytes32", name: "commitment", type: "bytes32" },
    ],
    name: "submitCommitment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "bountyId", type: "uint256" },
      { internalType: "string", name: "answer", type: "string" },
      { internalType: "bytes32", name: "salt", type: "bytes32" },
    ],
    name: "revealAnswer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ---- judge & finalize ----
  {
    inputs: [
      { internalType: "uint256", name: "bountyId", type: "uint256" },
      { internalType: "bytes", name: "llmInput", type: "bytes" },
    ],
    name: "judgeAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "bountyId", type: "uint256" },
      { internalType: "string", name: "verdictRef", type: "string" },
      { internalType: "bytes32", name: "verdictHash", type: "bytes32" },
    ],
    name: "setVerdictReference",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "bountyId", type: "uint256" },
      { internalType: "uint256", name: "winnerIndex", type: "uint256" },
    ],
    name: "finalizeWinner",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ---- views ----
  {
    inputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    name: "getBounty",
    outputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "rubric", type: "string" },
      { internalType: "uint256", name: "reward", type: "uint256" },
      { internalType: "uint256", name: "submissionDeadline", type: "uint256" },
      { internalType: "uint256", name: "revealDeadline", type: "uint256" },
      { internalType: "bool", name: "judged", type: "bool" },
      { internalType: "bool", name: "finalized", type: "bool" },
      { internalType: "uint256", name: "submissionCount", type: "uint256" },
      { internalType: "uint256", name: "revealedCount", type: "uint256" },
      { internalType: "uint256", name: "winnerIndex", type: "uint256" },
      { internalType: "bytes", name: "aiReview", type: "bytes" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    name: "getVerdictReference",
    outputs: [
      { internalType: "string", name: "verdictRef", type: "string" },
      { internalType: "bytes32", name: "verdictHash", type: "bytes32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "bountyId", type: "uint256" },
      { internalType: "uint256", name: "index", type: "uint256" },
    ],
    name: "getSubmission",
    outputs: [
      { internalType: "address", name: "submitter", type: "address" },
      { internalType: "bytes32", name: "commitment", type: "bytes32" },
      { internalType: "bool", name: "revealed", type: "bool" },
      { internalType: "string", name: "answer", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "bountyId", type: "uint256" }],
    name: "submissionCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "answer", type: "string" },
      { internalType: "bytes32", name: "salt", type: "bytes32" },
      { internalType: "address", name: "submitter", type: "address" },
      { internalType: "uint256", name: "bountyId", type: "uint256" },
    ],
    name: "computeCommitment",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "pure",
    type: "function",
  },
] as const;

export default abi;
