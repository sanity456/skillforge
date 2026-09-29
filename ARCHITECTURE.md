# SkillForge v1 architecture

## Product boundary

SkillForge issues public, challenge-specific achievement records. It does not claim to prove a person's identity, authorship, employment readiness, or professional qualification.

The frontend owns wallet connection, navigation, input assistance, non-authoritative previews, and readable scorecard presentation. The GenLayer contract owns locked challenge definitions, attempt limits, validator-mediated evaluation, credential issuance, and the immutable submission record. Public submission text and published rubrics are the evidence validators evaluate.

## Consequential flow

1. The owner creates a versioned challenge with four fixed criteria and a pass mark.
2. The owner publishes it; its rubric cannot be edited in place.
3. A wallet submits public work with explicit consent and a unique request ID.
4. Validators independently score the same work. They must agree on pass/fail and remain within bounded score tolerances.
5. The accepted result consumes one attempt. Passing creates or improves the wallet's challenge-specific credential.

The contract rejects native value. Paid competitions and escrow are deliberately outside v1.
