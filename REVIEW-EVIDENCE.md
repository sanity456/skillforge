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
| `0x7cef5dbbd598ba74ef9c665c9853e573448d97d0` | [Submission 3](https://explorer-studio.genlayer.com/tx/0x4d3de717ed05d93eac875dff42892592dcc71e6228b28018523c961049a76849), `2026-10-01T16:20:34.981580+00:00` | `RETRY_AVAILABLE`; `CRITICAL_REQUIREMENT_MISSED`; 5/100; criteria `0, 0, 0, 5`; attempt 2; 1 remaining |

The first two rows were independently checked against `get_submission("submission-1")` and `get_submission("submission-2")` at `LATEST_FINAL` and against each wallet's transaction list. Both have the same public work hash, `542a7ba254074a341fc488562c7d53037cf005544d647ea909b035b9110583f3`. Those two cases prove separate wallets can receive their own records for the same answer; by themselves, they do **not** demonstrate grading two different answers. Submission 3 below supplies the distinct-answer case.

The exact submitted text in both cases was:

> Hi, I’m sorry the item didn’t fit. Because it arrived 21 days ago, it is within the 30-day return window. If the item is unworn, it meets the conditions stated in the return policy. Please contact support to start the return and ask for the next steps. I can’t promise an outcome beyond what the policy states.

The expected rule is `total >= 70` and `critical_failure == false`, yielding `CREDENTIAL_EARNED` with reason `PASSED_THRESHOLD`. Both finalized assessments reported `scores = {criterion_1: 25, criterion_2: 24, criterion_3: 22, criterion_4: 24}`, `total = 95`, `critical_failure = false`, and `passed = true`. The accepted narrative feedback was:

- Submission 1 — summary: “The response correctly notes the 21‑day timeframe, confirms the unworn condition, expresses empathy, avoids promising outcomes, and directs the customer to contact support for the return.” Strength: “Accurate application of the 30‑day unworn‑item policy and empathetic tone.” Improvement: “Provide a more specific action (e.g., a link or contact method) to make the next step clearer and slightly tighten the wording.”
- Submission 2 — summary: “The response correctly applies the 30-day unworn-item policy to the customer’s situation, acknowledges the fit issue empathetically, and avoids inventing facts or overpromising. It gives a practical next step by directing the customer to contact support to begin the return process. The language is clear, concise, and respectful throughout.” Strength: “It accurately connects the stated facts to the policy: 21 days is within 30 days, and eligibility depends on the item being unworn. It also stays careful by not guaranteeing an outcome beyond the policy.” Improvement: “Make the next step slightly more concrete, such as asking the customer to contact support with their order details to start the return request, while still avoiding any invented process details.”

### Distinct-answer failure and credential preservation

Submission 3 was sent by the same wallet as Submission 1 to the same locked challenge and rubric, with `0 GEN` contract value. The exact input was:

> Because your order arrived 21 days ago, the return period is over. Our policy is only 7 days, and it does not matter whether the item was worn. Please do not contact support; there is no way to start a return. I guarantee this decision is final.

The input's stored work hash is `d8d3d9056bb42e7ffcb15a801c50c4d3c62ae753d04da0085862a570ed19d53f`, different from the passing submissions. The expected result was a failed assessment because the response contradicts the 30-day, unworn-item policy and invents a 7-day limit. At `LATEST_FINAL`, `get_submission("submission-3")` returned `passed = false`, `critical_failure = true`, `total = 5`, `scores = {criterion_1: 0, criterion_2: 0, criterion_3: 0, criterion_4: 5}`, verdict `RETRY_AVAILABLE`, reason `CRITICAL_REQUIREMENT_MISSED`, and `attempts_remaining = 1`. Its assessment summary states that the answer contradicts the policy, blocks contact with support, and guarantees an outcome. The wallet's `get_profile` shows two attempts and still retains the original 95-point credential from Submission 1; the failed retry did not overwrite it.

## Verification boundary

The direct contract tests mock model output and cover deterministic success, failure, limits, consent, idempotency, and malformed responses. The three-validator local test covers deployment and owner-managed challenge lifecycle, but it does **not** exercise live AI scoring. Submissions 1 and 2 are live positive scoring evidence; Submission 3 is live negative scoring evidence. A rejected-wallet transaction has not been linked here; do not claim that scenario is live-proven.

The public app returned HTTP 200 without authentication when checked. On `2026-10-01`, the Explorer intermittently returned HTTP 503 to unsigned-in requests, including for older known-finalized transactions; a later unsigned-in request returned HTTP 200. Studionet RPC independently returned the finalized transaction and stored submission above. Reopen the Explorer links before review and confirm their client-rendered details are visible, because an HTTP 200 shell alone does not prove that.
