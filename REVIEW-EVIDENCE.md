# SkillForge v1 review evidence

SkillForge is a public challenge-and-credential app on GenLayer Studionet (chain ID `61999`). It accepts no contract payment. The [public app](https://skillforge-blond-psi.vercel.app/) and [implementation commit `ce4ec10fbd463574490d0890b42c835dab6a427b`](https://github.com/sanity456/skillforge/tree/ce4ec10fbd463574490d0890b42c835dab6a427b) are the reviewer entry points. This is a product review record, not a claim that GenLayer has approved a submission.

## Contract and build identity

- Deployed contract: `0x2C9BFBCE8d68C7098e719cE23e49a9fe05a1d2Ae`.
- [Deployment transaction](https://explorer-studio.genlayer.com/tx/0xeb116ea970de3173e37a00193d2468a0f96f71d1816afb6a2071346051db7a26): `FINALIZED`, `2026-10-01T11:10:56.718942+00:00`, value `0 GEN`.
- [Immutable contract source](https://github.com/sanity456/skillforge/blob/ce4ec10fbd463574490d0890b42c835dab6a427b/contracts/skillforge.py) SHA-256: `8fc37a87dab92d7ce0d14626cd61d9e767e3915a8f12f71657441af306c067a1`. The base64-decoded code returned by Studionet `gen_getContractCode` at the deployed address matched this file byte-for-byte.
- [Passing clean Ubuntu 24.04 CI run for the implementation commit](https://github.com/sanity456/skillforge/actions/runs/36886344681): pinned GenVM lint, 23 direct contract tests, local three-validator lifecycle, 9 frontend tests, and production build.

## Finalized live wallet cases

The challenge `support-clarity-v1` was [created](https://explorer-studio.genlayer.com/tx/0x64bfd32b45024b93f2ef8625920d764b045729062cb4ff6ffa90e792913c3347) at `2026-10-01T11:34:05.213777+00:00` and [published](https://explorer-studio.genlayer.com/tx/0x8e233bcd90d7860f2d3c05dc94969b54cc6269865a2d6a452e32e66586a1d771) at `2026-10-01T11:35:16.182954+00:00`. Both transactions are `FINALIZED` with value `0 GEN`. Its locked rubric hash is `e53c9acb652a960959be51bca1c30f3366c0da91ee2246d8e27719d202a1d3fc`; the threshold is 70/100, with three attempts per wallet.

| Wallet | Transaction and chain timestamp (UTC) | Finalized output |
| --- | --- | --- |
| `0x7cef5dbbd598ba74ef9c665c9853e573448d97d0` | [Submission 1](https://explorer-studio.genlayer.com/tx/0xfa0ef71ddfa1d749b1be6ae395f261028a3ff4d382487d7a68a13b38a400be4c), `2026-10-01T11:39:33.863901+00:00` | `CREDENTIAL_EARNED`; `PASSED_THRESHOLD`; 95/100; criteria `25, 24, 22, 24`; attempt 1; 2 remaining |
| `0xab99c741494bef91fae66144dda31be93180bad4` | [Submission 2](https://explorer-studio.genlayer.com/tx/0x0242a770e96b704911e7eca0ab779eea1ec548a13ae252f54317518ec86f908d), `2026-10-01T11:52:15.523147+00:00` | `CREDENTIAL_EARNED`; `PASSED_THRESHOLD`; 95/100; criteria `25, 24, 22, 24`; attempt 1; 2 remaining |

Each row was independently checked against `get_submission("submission-1")` or `get_submission("submission-2")` at `LATEST_FINAL` and against the transaction list for its wallet. Both submissions have the same public work hash, `542a7ba254074a341fc488562c7d53037cf005544d647ea909b035b9110583f3`. These cases prove separate wallets can receive their own records for the same answer; they do **not** demonstrate grading two different answers.

The exact submitted text in both cases was:

> Hi, I’m sorry the item didn’t fit. Because it arrived 21 days ago, it is within the 30-day return window. If the item is unworn, it meets the conditions stated in the return policy. Please contact support to start the return and ask for the next steps. I can’t promise an outcome beyond what the policy states.

The expected rule is `total >= 70` and `critical_failure == false`, yielding `CREDENTIAL_EARNED` with reason `PASSED_THRESHOLD`. Both finalized assessments reported `scores = {criterion_1: 25, criterion_2: 24, criterion_3: 22, criterion_4: 24}`, `total = 95`, `critical_failure = false`, and `passed = true`. The accepted narrative feedback was:

- Submission 1 — summary: “The response correctly notes the 21‑day timeframe, confirms the unworn condition, expresses empathy, avoids promising outcomes, and directs the customer to contact support for the return.” Strength: “Accurate application of the 30‑day unworn‑item policy and empathetic tone.” Improvement: “Provide a more specific action (e.g., a link or contact method) to make the next step clearer and slightly tighten the wording.”
- Submission 2 — summary: “The response correctly applies the 30-day unworn-item policy to the customer’s situation, acknowledges the fit issue empathetically, and avoids inventing facts or overpromising. It gives a practical next step by directing the customer to contact support to begin the return process. The language is clear, concise, and respectful throughout.” Strength: “It accurately connects the stated facts to the policy: 21 days is within 30 days, and eligibility depends on the item being unworn. It also stays careful by not guaranteeing an outcome beyond the policy.” Improvement: “Make the next step slightly more concrete, such as asking the customer to contact support with their order details to start the return request, while still avoiding any invented process details.”

## Verification boundary

The direct contract tests mock model output and cover deterministic success, failure, limits, consent, idempotency, and malformed responses. The three-validator local test covers deployment and owner-managed challenge lifecycle, but it does **not** exercise live AI scoring. The two transactions above are the live positive scoring evidence. A live negative-scoring or rejected-wallet transaction has not yet been linked here; do not claim that scenario is live-proven.

The public app and Explorer transaction URLs returned HTTP 200 without authentication when checked. Reviewers should still open each link themselves and confirm that the client-rendered transaction details are visible.
