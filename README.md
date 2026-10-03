# SkillForge

SkillForge turns practical work into public, validator-verified achievement records on GenLayer. A challenge publishes its brief, four criteria, passing threshold, and attempt limit before anyone submits. A wallet earns a challenge-specific credential only when the accepted GenLayer evaluation passes that locked rubric.

## Current checkpoint

SkillForge v1 is deployed to stable GenLayer Studionet and the public Vercel app is live:

- wallet-first React interface with Explore, challenge workspace, My Proof, and Creator Studio;
- pinned GenVM contract with locked challenge definitions, public-data consent, retry limits, idempotent requests, structured scorecards, and credential issuance;
- no escrow or contract payment—every write rejects native value;
- 23 direct contract tests, 12 frontend tests, a three-validator lifecycle test, GenVM lint, TypeScript checks, and production build in the Ubuntu workflow;
- responsive layout verified at desktop and 390px mobile width.

The checked-in deployment manifest records the verified Studionet contract and source SHA-256. Visitors can load the same deployment without relying on the deploying wallet's browser storage. The owner wallet can create and publish challenges; learner wallets can submit only to open on-chain challenges.

### Creating a challenge (reviewer walkthrough)

Challenge creation is intentionally curated, not open to every wallet. On the [public app](https://skillforge-blond-psi.vercel.app/), select **Creator studio** in the top navigation. A signed-out visitor or non-owner wallet sees the owner-only explanation and the public owner address; the creation form appears only when the deployed contract owner wallet (`0x7Cef5DBbD598ba74EF9C665c9853E573448d97D0`) is connected on GenLayer Studionet. The owner fills in an ID, title, category, brief, four scoring criteria, pass mark, and attempt limit, acknowledges that the challenge details are public, then selects **Create & publish**. This requires two separate finalized wallet approvals: creation, then publication. It sends `0 GEN` contract value. Once published, the challenge appears in Explore and any wallet may submit work. No reviewer needs the owner wallet to inspect the UI or try an existing challenge.

- Contract: `0x2C9BFBCE8d68C7098e719cE23e49a9fe05a1d2Ae`
- Network: GenLayer Studionet, chain ID `61999`
- Contract source SHA-256: `8fc37a87dab92d7ce0d14626cd61d9e767e3915a8f12f71657441af306c067a1`
- Public app: https://skillforge-blond-psi.vercel.app

## Product boundary

A SkillForge credential proves that one wallet passed one published challenge version. It does not prove identity, authorship, employment readiness, or professional qualification. Submission text is public and the UI requires explicit acknowledgement before a write.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the consensus boundary and state transition.

## Local development

Requirements: Node `24.18.0`, Python `3.12`, and the exact packages pinned in `requirements-dev.txt`.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4204`.

## Verification

```bash
$env:GENVM_VERSION='v0.2.16'
.venv\Scripts\genvm-lint.exe check contracts\skillforge.py --json
.venv\Scripts\python.exe -m pytest tests\direct -q
npm test
npm run build
```

The direct tests mock model output and cover deterministic state transitions. The Linux CI run also starts a local three-validator simulator and exercises deployment, challenge creation/publication, owner-only closure, and the closed state. A live validator-scoring transaction still requires the connected learner wallet on Studionet.

## Verification status

The GitHub Actions workflow runs the pinned GenVM lint, complete direct contract suite, three-validator local lifecycle test, frontend tests, and production build on Ubuntu 24.04. Keep the latest workflow green before presenting a release. [Review evidence](REVIEW-EVIDENCE.md) links the immutable source, CI run, and finalized live wallet cases while stating the scenarios that are not yet live-proven.
