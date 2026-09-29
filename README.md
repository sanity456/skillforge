# SkillForge

SkillForge turns practical work into public, validator-verified achievement records on GenLayer. A challenge publishes its brief, four criteria, passing threshold, and attempt limit before anyone submits. A wallet earns a challenge-specific credential only when the accepted GenLayer evaluation passes that locked rubric.

## Current checkpoint

The v1 foundation is implemented locally:

- wallet-first React interface with Explore, challenge workspace, My Proof, and Creator Studio;
- pinned GenVM contract with locked challenge definitions, public-data consent, retry limits, idempotent requests, structured scorecards, and credential issuance;
- no escrow or contract payment—every write rejects native value;
- 22 direct contract tests, 4 UI tests, a three-validator lifecycle test in clean Ubuntu CI, GenVM lint, TypeScript checks, and production build;
- responsive layout verified at desktop and 390px mobile width.

The UI starts in preview mode because no contract is deployed. Use Creator Studio with the owner wallet to deploy the pinned contract to Studionet. After the final receipt and protocol/owner checks pass, the deployment address is saved in that browser's local storage; the owner can then create and publish a challenge. Learner wallets can submit only to open on-chain challenges.

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

## Next activation milestone

1. Add callback-level validator tests and a small full-consensus suite.
2. Deploy the pinned contract to Studionet from the owner wallet.
3. Verify deployed source SHA-256 against this repository.
4. Create and publish the three catalog challenges on-chain.
5. Record a human-wallet pass and fail path, then configure the verified deployment manifest.
6. Publish a separate public preview only after the wallet evidence passes.
