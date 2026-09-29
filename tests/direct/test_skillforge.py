"""Direct-mode state tests. Model outputs are mocked; validator consensus is integration scope."""
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
T0 = "2026-09-27T12:00:00+00:00"


def score(total=80, critical=False):
    base = total // 4
    values = [base, base, base, total - base * 3]
    return {
        "scores": {f"criterion_{index + 1}": value for index, value in enumerate(values)},
        "critical_failure": critical,
        "summary": "The work addresses the published brief.",
        "strength": "Clear and audience-aware.",
        "improvement": "Add one more concrete detail.",
    }


def mock(vm, result=None):
    vm.clear_mocks()
    vm.mock_llm(r"(?s).*SKILLFORGE_EVALUATE_V1.*", json.dumps(score() if result is None else result))
    vm.mock_llm(r"(?s).*SKILLFORGE_AUDIT_V1.*", '{"faithful":true}')


@pytest.fixture
def contract(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp(T0)
    return direct_deploy(str(ROOT / "contracts" / "skillforge.py"), sdk_version="v0.2.16")


def create(contract):
    return contract.create_challenge(
        "support-clarity-v1", "Calm the refund storm", "Customer support",
        "Write a concise response using the public refund policy.",
        "Accurately applies the stated policy.", "Shows empathy without admitting invented facts.",
        "Gives a concrete next step.", "Uses clear, concise language.", 70, 3, True,
    )


@pytest.fixture
def opened(contract):
    create(contract)
    contract.publish_challenge("support-clarity-v1")
    return contract


def test_protocol_rejects_funds(contract):
    protocol = contract.get_protocol()
    assert protocol["protocol"] == "skillforge-v1"
    assert protocol["owner"] == str(contract.owner).lower()
    assert protocol["funds_accepted"] is False
    assert protocol["score_max"] == 100
    assert protocol["criteria_count"] == 4
    assert protocol["max_work_bytes"] == 5000


def test_owner_creates_locked_draft(contract):
    challenge = create(contract)
    assert challenge["status"] == "DRAFT"
    assert challenge["created_at"] == T0
    assert len(challenge["criteria"]) == 4
    assert len(challenge["rubric_hash"]) == 64
    with pytest.raises(Exception, match="CHALLENGE_EXISTS"):
        create(contract)


def test_normal_line_breaks_are_allowed_in_public_text(contract):
    challenge = contract.create_challenge(
        "multiline-brief", "Multiline brief", "Testing", "First line.\nSecond line.",
        "Criterion one.", "Criterion two.", "Criterion three.", "Criterion four.", 70, 2, True,
    )
    assert challenge["brief"] == "First line.\nSecond line."


def test_non_owner_cannot_create_or_publish(contract, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="OWNER_REQUIRED"):
        create(contract)
    direct_vm.sender = direct_alice
    create(contract)
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="OWNER_REQUIRED"):
        contract.publish_challenge("support-clarity-v1")


def test_publish_and_close_lifecycle(opened, direct_vm):
    assert opened.get_challenge("support-clarity-v1")["status"] == "OPEN"
    direct_vm.warp("2026-09-27T13:00:00+00:00")
    closed = opened.close_challenge("support-clarity-v1")
    assert closed["status"] == "CLOSED"
    assert closed["closed_at"] == "2026-09-27T13:00:00+00:00"


def test_passing_submission_issues_credential(opened, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    mock(direct_vm, score(82))
    result = opened.submit_work("support-clarity-v1", "A thoughtful public\nresponse.", "attempt-one", True)
    assert result["verdict"] == "CREDENTIAL_EARNED"
    assert result["reason_code"] == "PASSED_THRESHOLD"
    assert result["assessment"]["total"] == 82
    profile = opened.get_profile(str(direct_bob))
    assert profile["credentials"][0]["score"] == 82
    assert profile["attempts"] == [{"challenge_id": "support-clarity-v1", "attempts": 1}]
    assert profile["submissions"][0]["id"] == result["id"]
    assert "work" not in profile["submissions"][0]


def test_failed_attempt_has_reason_and_no_credential(opened, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    mock(direct_vm, score(55))
    result = opened.submit_work("support-clarity-v1", "An incomplete answer.", "attempt-one", True)
    assert result["verdict"] == "RETRY_AVAILABLE"
    assert result["reason_code"] == "BELOW_THRESHOLD"
    assert opened.get_profile(str(direct_bob))["credentials"] == []


def test_critical_failure_cannot_pass(opened, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    mock(direct_vm, score(90, critical=True))
    result = opened.submit_work("support-clarity-v1", "A polished but disallowed answer.", "attempt-one", True)
    assert result["reason_code"] == "CRITICAL_REQUIREMENT_MISSED"
    assert result["assessment"]["passed"] is False


def test_request_id_is_idempotent(opened, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    mock(direct_vm)
    first = opened.submit_work("support-clarity-v1", "A public answer.", "stable-request", True)
    again = opened.submit_work("support-clarity-v1", "A public answer.", "stable-request", True)
    assert again == first
    with pytest.raises(Exception, match="REQUEST_REUSED"):
        opened.submit_work("support-clarity-v1", "Changed answer.", "stable-request", True)


def test_attempt_limit_is_enforced(opened, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    mock(direct_vm, score(50))
    for index in range(3):
        opened.submit_work("support-clarity-v1", f"Attempt {index}.", f"request-{index}", True)
    with pytest.raises(Exception, match="ATTEMPT_LIMIT_REACHED"):
        opened.submit_work("support-clarity-v1", "Attempt four.", "request-four", True)


def test_last_failed_attempt_is_marked_exhausted(contract, direct_vm, direct_bob):
    contract.create_challenge(
        "single-attempt", "One attempt", "Test", "Test brief.",
        "Criterion one.", "Criterion two.", "Criterion three.", "Criterion four.", 70, 1, True,
    )
    contract.publish_challenge("single-attempt")
    direct_vm.sender = direct_bob
    mock(direct_vm, score(55))
    result = contract.submit_work("single-attempt", "A concise but incomplete answer.", "final-attempt", True)
    assert result["verdict"] == "ATTEMPTS_EXHAUSTED"
    assert result["attempts_remaining"] == 0


@pytest.mark.parametrize("consent", [False, 1, "true", None])
def test_public_consent_is_strict(opened, direct_vm, direct_bob, consent):
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="PUBLIC_DATA_CONSENT_REQUIRED"):
        opened.submit_work("support-clarity-v1", "Public answer.", "request", consent)


def test_value_rejected_on_writes(opened, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    direct_vm.value = 1
    with pytest.raises(Exception, match="FUNDS_NOT_ACCEPTED"):
        opened.submit_work("support-clarity-v1", "Public answer.", "request", True)


@pytest.mark.parametrize("bad", ["not json", {}, {"scores": {}, "critical_failure": False, "summary": "x", "strength": "x", "improvement": "x"}, score(101)])
def test_malformed_model_output_does_not_consume_attempt(opened, direct_vm, direct_bob, bad):
    direct_vm.sender = direct_bob
    mock(direct_vm, bad)
    with pytest.raises(Exception, match="LLM_ERROR"):
        opened.submit_work("support-clarity-v1", "Public answer.", "request", True)
    assert opened.get_profile(str(direct_bob))["attempts"] == []


def test_closed_challenge_rejects_new_work(opened, direct_vm, direct_bob):
    opened.close_challenge("support-clarity-v1")
    direct_vm.sender = direct_bob
    mock(direct_vm)
    with pytest.raises(Exception, match="CHALLENGE_NOT_OPEN"):
        opened.submit_work("support-clarity-v1", "Public answer.", "request", True)


def test_long_challenge_id_has_retrievable_submission(contract, direct_vm, direct_bob):
    challenge_id = "a" * 64
    contract.create_challenge(
        challenge_id, "Long ID", "Test", "Test brief.",
        "Criterion one.", "Criterion two.", "Criterion three.", "Criterion four.", 70, 1, True,
    )
    contract.publish_challenge(challenge_id)
    direct_vm.sender = direct_bob
    mock(direct_vm, score(80))
    result = contract.submit_work(challenge_id, "A complete answer for the test.", "long-id-test", True)
    assert result["id"] == "submission-1"
    assert contract.get_submission(result["id"]) == result


def test_invalid_model_prose_is_classified_as_model_error(opened, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    invalid = score(80)
    invalid["summary"] = ""
    mock(direct_vm, invalid)
    with pytest.raises(Exception, match="LLM_ERROR.*INVALID_TEXT"):
        opened.submit_work("support-clarity-v1", "A sufficiently complete public answer.", "invalid-prose", True)
