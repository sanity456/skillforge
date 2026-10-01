"""Local consensus test for deployment and owner-managed challenge lifecycle."""
import os

import pytest
from gltest import create_accounts, get_contract_factory, get_gl_client
from gltest.assertions import tx_execution_succeeded
from gltest.contracts import Contract
from gltest.utils import extract_contract_address

def contract_method(contract, schema, python_name):
    """Resolve a Python contract method through the SDK-generated schema name."""
    expected = python_name.replace("_", "").lower()
    method_names = schema.get("methods", {})
    matches = [name for name in method_names if name.replace("_", "").lower() == expected]
    if len(matches) != 1:
        raise AssertionError(
            f"Expected one schema method matching {python_name!r}; "
            f"found {matches!r} among {list(method_names)!r}"
        )
    return getattr(contract, matches[0])


@pytest.mark.parametrize("schema_name", ["get_protocol", "getProtocol"])
def test_contract_method_resolves_generated_names(schema_name):
    class FakeContract:
        pass

    expected = object()
    setattr(FakeContract, schema_name, expected)
    schema = {"methods": {schema_name: {"readonly": True}}}

    assert contract_method(FakeContract(), schema, "get_protocol") is expected


@pytest.mark.integration
@pytest.mark.skipif(
    os.getenv("RUN_SKILLFORGE_INTEGRATION") != "1",
    reason="Set RUN_SKILLFORGE_INTEGRATION=1 with local GenLayer Studio running",
)
def test_deploy_create_publish_and_close():
    from gltest_cli.config.general import get_general_config

    assert get_general_config().get_rpc_url() == "http://127.0.0.1:4000/api"
    owner, learner = create_accounts(2)
    factory = get_contract_factory("SkillForge")

    deploy_receipt = factory.deploy_contract_tx(
        account=owner,
        args=[],
        consensus_max_rotations=5,
    )
    assert tx_execution_succeeded(deploy_receipt), deploy_receipt
    address = extract_contract_address(deploy_receipt)
    schema = get_gl_client().get_contract_schema(address)
    contract = Contract.new(address, schema, account=owner)

    protocol = contract_method(contract, schema, "get_protocol")().call()
    assert protocol["protocol"] == "skillforge-v1"
    assert protocol["owner"].lower() == owner.address.lower()
    assert protocol["funds_accepted"] is False

    challenge_id = "consensus-smoke-" + owner.address[-8:].lower()
    create_receipt = contract_method(contract, schema, "create_challenge")(
        args=[
            challenge_id,
            "Consensus smoke challenge",
            "Testing",
            "Write a short response to the published brief.",
            "Addresses the brief.",
            "Uses clear language.",
            "Gives a practical next step.",
            "Avoids invented details.",
            70,
            2,
            True,
        ]
    ).transact(consensus_max_rotations=5)
    assert tx_execution_succeeded(create_receipt), create_receipt
    get_challenge = contract_method(contract, schema, "get_challenge")
    assert get_challenge(args=[challenge_id]).call()["status"] == "DRAFT"

    publish_receipt = contract_method(contract, schema, "publish_challenge")(
        args=[challenge_id]
    ).transact(consensus_max_rotations=5)
    assert tx_execution_succeeded(publish_receipt), publish_receipt
    assert get_challenge(args=[challenge_id]).call()["status"] == "OPEN"

    learner_contract = contract.connect(learner)
    close_challenge = contract_method(learner_contract, schema, "close_challenge")
    denied_receipt = close_challenge(args=[challenge_id]).transact(consensus_max_rotations=5)
    assert not tx_execution_succeeded(denied_receipt)
    assert get_challenge(args=[challenge_id]).call()["status"] == "OPEN"

    close_receipt = contract_method(contract, schema, "close_challenge")(
        args=[challenge_id]
    ).transact(consensus_max_rotations=5)
    assert tx_execution_succeeded(close_receipt), close_receipt
    assert get_challenge(args=[challenge_id]).call()["status"] == "CLOSED"
