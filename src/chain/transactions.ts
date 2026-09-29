type RecordLike = Record<string, unknown>;

function record(value: unknown): RecordLike {
  return value && typeof value === 'object' ? (value as RecordLike) : {};
}

function statusName(value: unknown): string {
  const receipt = record(value);
  const raw = receipt.statusName ?? receipt.status_name ?? receipt.status;
  if (/^\d+$/.test(String(raw))) {
    return ['UNINITIALIZED', 'PENDING', 'PROPOSING', 'COMMITTING', 'REVEALING', 'ACCEPTED', 'UNDETERMINED', 'FINALIZED', 'CANCELED'][Number(raw)] ?? 'UNKNOWN';
  }
  return String(raw ?? '').toUpperCase();
}

function executionState(value: unknown): 'success' | 'error' | 'unknown' {
  const receipt = record(value);
  const named = receipt.txExecutionResultName ?? receipt.tx_execution_result_name;
  if (named === 'FINISHED_WITH_RETURN') return 'success';
  if (named === 'FINISHED_WITH_ERROR') return 'error';
  const numeric = receipt.txExecutionResult ?? receipt.tx_execution_result;
  if (numeric !== undefined && numeric !== null) {
    if (Number(numeric) === 1) return 'success';
    if (Number(numeric) === 2) return 'error';
  }
  const consensus = record(receipt.consensus_data);
  const leaders = consensus.leader_receipt;
  const leader = record(Array.isArray(leaders) ? leaders[0] : leaders);
  if (leader.execution_result === 'SUCCESS') return 'success';
  if (leader.execution_result === 'ERROR' || leader.execution_result === 'FAILURE') return 'error';
  return 'unknown';
}

function errorMessage(value: unknown): string {
  const receipt = record(value);
  const consensus = record(receipt.consensus_data);
  const leaders = consensus.leader_receipt;
  const leader = record(Array.isArray(leaders) ? leaders[0] : leaders);
  const vm = record(leader.genvm_result);
  const result = record(leader.result);
  const payload = record(result.payload);
  return String(vm.stderr ?? leader.error ?? (result.status === 'error' ? payload.readable : '') ?? 'The contract rejected this action. No state change was applied.').slice(0, 600);
}

export type TransactionProgress = { hash: string; status: string };

export async function waitForFinalizedTransaction(
  hash: string,
  fetchReceipt: () => Promise<unknown>,
  onProgress?: (progress: TransactionProgress) => void,
) {
  let previousStatus = '';
  let rpcFailures = 0;
  for (let attempt = 0; attempt < 150; attempt++) {
    let receipt: unknown;
    try {
      receipt = await fetchReceipt();
      rpcFailures = 0;
    } catch (error) {
      rpcFailures += 1;
      if (rpcFailures >= 5) throw new Error(`Could not read transaction status. Check ${hash} in the explorer before retrying.`);
      await new Promise((resolve) => setTimeout(resolve, 4000));
      continue;
    }
    const status = statusName(receipt);
    if (status && status !== previousStatus) {
      previousStatus = status;
      onProgress?.({ hash, status });
    }
    if (['CANCELED', 'UNDETERMINED', 'LEADER_TIMEOUT', 'VALIDATORS_TIMEOUT'].includes(status)) {
      throw new Error(`Studionet ended transaction ${hash} with ${status}. Check the recorded result before retrying.`);
    }
    if (status === 'FINALIZED') {
      const outcome = executionState(receipt);
      if (outcome === 'error') throw new Error(`${errorMessage(receipt)} Transaction: ${hash}`);
      if (outcome !== 'success') throw new Error(`Transaction ${hash} finalized, but successful contract execution could not be verified.`);
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error(`Transaction ${hash} is still pending. Check its status before retrying.`);
}
