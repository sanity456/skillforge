"""Local consensus test for deployment and owner-managed challenge lifecycle."""
import os

import pytest
from gltest import create_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.contracts import Contract
from gltest.utils import extract_contract_address

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
    # glsim 0.29.2 currently returns an empty method table from its schema
    # endpoint. Supply the minimal ABI for the lifecycle calls under test.
    schema = {
        "methods": {
            "get_protocol": {"readonly": True},
            "get_challenge": {"readonly": True},
            "create_challenge": {"readonly": False},
            "publish_challenge": {"readonly": False},
            "close_challenge": {"readonly": False},
        }
    }
    contract = Contract.new(address, schema, account=owner)

    protocol = contract.get_protocol().call()
    assert protocol["protocol"] == "skillforge-v1"
    assert protocol["owner"].lower() == owner.address.lower()
    assert protocol["funds_accepted"] is False

    challenge_id = "consensus-smoke-" + owner.address[-8:].lower()
    create_receipt = contract.create_challenge(
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
    assert contract.get_challenge(args=[challenge_id]).call()["status"] == "DRAFT"

    publish_receipt = contract.publish_challenge(args=[challenge_id]).transact(consensus_max_rotations=5)
    assert tx_execution_succeeded(publish_receipt), publish_receipt
    assert contract.get_challenge(args=[challenge_id]).call()["status"] == "OPEN"

    learner_contract = contract.connect(learner)
    denied_receipt = learner_contract.close_challenge(args=[challenge_id]).transact(consensus_max_rotations=5)
    assert not tx_execution_succeeded(denied_receipt)
    assert contract.get_challenge(args=[challenge_id]).call()["status"] == "OPEN"

    close_receipt = contract.close_challenge(args=[challenge_id]).transact(consensus_max_rotations=5)
    assert tx_execution_succeeded(close_receipt), close_receipt
    assert contract.get_challenge(args=[challenge_id]).call()["status"] == "CLOSED"
