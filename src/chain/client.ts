import deployment from './deployment.json';
import { waitForFinalizedTransaction, type TransactionProgress } from './transactions.ts';
import type { createClient } from 'genlayer-js';

export const CHAIN_ID = 61999;
export const RPC = 'https://studio.genlayer.com/api';

export type Address = `0x${string}`;
type SkillForgeClient = ReturnType<typeof createClient>;
type Provider = {
  request(request: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

const DEPLOYMENT_STORAGE_KEY = 'skillforge.studionet.contract.v1';
const PENDING_DEPLOYMENT_STORAGE_KEY = 'skillforge.studionet.pending-deployment.v1';

export type PendingDeployment = { hash: `0x${string}`; owner: Address; chainId: number };

export function getPendingDeployment(): PendingDeployment | null {
  if (typeof window === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PENDING_DEPLOYMENT_STORAGE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const attempt = value as Partial<PendingDeployment>;
    if (
      typeof attempt.hash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(attempt.hash) ||
      typeof attempt.owner !== 'string' || !/^0x[0-9a-f]{40}$/i.test(attempt.owner) ||
      attempt.chainId !== CHAIN_ID
    ) return null;
    return { hash: attempt.hash as `0x${string}`, owner: attempt.owner.toLowerCase() as Address, chainId: CHAIN_ID };
  } catch {
    return null;
  }
}

function savePendingDeployment(hash: string, owner: Address) {
  window.localStorage.setItem(PENDING_DEPLOYMENT_STORAGE_KEY, JSON.stringify({ hash, owner, chainId: CHAIN_ID }));
}

function clearPendingDeployment() {
  window.localStorage.removeItem(PENDING_DEPLOYMENT_STORAGE_KEY);
}

export function getDeploymentAddress(): Address | null {
  // A published build must use its reviewed deployment, regardless of a visitor's
  // older browser storage. Local storage is only for builds without a manifest.
  const configuredAddress: unknown = deployment.address;
  if (typeof configuredAddress === 'string' && /^0x[0-9a-f]{40}$/i.test(configuredAddress)) {
    return configuredAddress as Address;
  }
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
    if (saved && /^0x[0-9a-f]{40}$/i.test(saved)) return saved as Address;
  }
  return null;
}

export function hasDeployment() {
  return getDeploymentAddress() !== null;
}

export function provider(): Provider | undefined {
  return (window as Window & { ethereum?: Provider }).ethereum;
}

export async function walletState(p: Provider) {
  const [accounts, chainId] = await Promise.all([
    p.request({ method: 'eth_accounts' }),
    p.request({ method: 'eth_chainId' }),
  ]);
  const first = Array.isArray(accounts) ? accounts[0] : null;
  return {
    account:
      typeof first === 'string' && /^0x[0-9a-f]{40}$/i.test(first)
        ? (first.toLowerCase() as Address)
        : null,
    chainId:
      typeof chainId === 'string' && /^0x[0-9a-f]+$/i.test(chainId)
        ? Number.parseInt(chainId, 16)
        : null,
  };
}

export async function connect() {
  const p = provider();
  if (!p) throw new Error('Install or open a wallet extension to continue.');
  await p.request({ method: 'eth_requestAccounts' });
  return walletState(p);
}

export async function switchToStudionet() {
  const p = provider();
  if (!p) throw new Error('Wallet provider not found.');
  const chainId = `0x${CHAIN_ID.toString(16)}`;
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: 'GenLayer Studionet',
          nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
          rpcUrls: [RPC],
          blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
        },
      ],
    });
  }
  return walletState(p);
}

async function publicClient() {
  const address = getDeploymentAddress();
  if (!address) throw new Error('Deploy SkillForge to Studionet before using contract features.');
  const [{ createClient }, { studionet }] = await Promise.all([
    import('genlayer-js'),
    import('genlayer-js/chains'),
  ]);
  return createClient({ chain: studionet, endpoint: RPC });
}

export async function readContract(functionName: string, args: unknown[] = []) {
  const address = getDeploymentAddress();
  if (!address) throw new Error('Deploy SkillForge to Studionet before using contract features.');
  const { TransactionHashVariant } = await import('genlayer-js/types');
  return (await publicClient()).readContract({
    address,
    functionName,
    args: args as never[],
    jsonSafeReturn: true,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
}

export async function writeContract(
  account: Address,
  functionName: string,
  args: unknown[],
  onProgress?: (progress: TransactionProgress) => void,
) {
  const address = getDeploymentAddress();
  if (!address) throw new Error('Deploy SkillForge to Studionet before using contract features.');
  const p = provider();
  if (!p) throw new Error('Wallet provider not found.');
  const state = await walletState(p);
  if (state.account !== account) throw new Error('The active wallet changed. Review the action again.');
  if (state.chainId !== CHAIN_ID) throw new Error('Switch your wallet to GenLayer Studionet.');
  const [{ createClient }, { studionet }] = await Promise.all([
    import('genlayer-js'),
    import('genlayer-js/chains'),
  ]);
  type WalletProvider = NonNullable<Parameters<typeof createClient>[0]>['provider'];
  const client = createClient({
    chain: studionet,
    endpoint: RPC,
    account,
    provider: p as WalletProvider,
  });
  const hash = await client.writeContract({
    address,
    functionName,
    args: args as never[],
    value: 0n,
    leaderOnly: false,
  });
  onProgress?.({ hash: String(hash), status: 'SUBMITTED' });
  const receipt = await waitForFinalizedTransaction(
    String(hash),
    () => client.getTransaction({ hash }),
    onProgress,
  );
  return { hash: String(hash), receipt };
}

export async function deploySkillForge(
  account: Address,
  contractCode: string,
  onProgress?: (progress: TransactionProgress) => void,
) {
  if (getDeploymentAddress()) throw new Error('SkillForge already has a saved deployment.');
  const pending = getPendingDeployment();
  if (pending) throw new Error(`A deployment transaction is already recorded (${pending.hash}). Check that transaction before sending another.`);
  const p = provider();
  if (!p) throw new Error('Wallet provider not found.');
  const state = await walletState(p);
  if (state.account !== account) throw new Error('The active wallet changed. Review the action again.');
  if (state.chainId !== CHAIN_ID) throw new Error('Switch your wallet to GenLayer Studionet.');
  const [{ createClient }, { studionet }] = await Promise.all([
    import('genlayer-js'),
    import('genlayer-js/chains'),
  ]);
  type WalletProvider = NonNullable<Parameters<typeof createClient>[0]>['provider'];
  const client = createClient({
    chain: studionet,
    endpoint: RPC,
    account,
    provider: p as WalletProvider,
  });
  const hash = await client.deployContract({ code: contractCode, leaderOnly: false });
  const typedHash = hash as unknown as Parameters<typeof client.getTransaction>[0]['hash'];
  savePendingDeployment(String(hash), account);
  onProgress?.({ hash: String(hash), status: 'SUBMITTED' });
  const readClient = createClient({ chain: studionet, endpoint: RPC });
  return verifySubmittedDeployment(client, readClient, typedHash, String(hash), account, onProgress);
}

export async function resumeSkillForgeDeployment(
  account: Address,
  onProgress?: (progress: TransactionProgress) => void,
) {
  const pending = getPendingDeployment();
  if (!pending) throw new Error('There is no saved SkillForge deployment to check.');
  if (pending.owner !== account) throw new Error(`This pending deployment belongs to ${pending.owner}. Reconnect that wallet to check it.`);
  const p = provider();
  if (!p) throw new Error('Wallet provider not found.');
  const state = await walletState(p);
  if (state.account !== account) throw new Error('The active wallet changed. Reconnect the wallet that sent the saved deployment.');
  if (state.chainId !== CHAIN_ID) throw new Error('Switch your wallet to GenLayer Studionet before checking the saved deployment.');
  const [{ createClient }, { studionet }] = await Promise.all([
    import('genlayer-js'),
    import('genlayer-js/chains'),
  ]);
  const client = createClient({ chain: studionet, endpoint: RPC });
  const typedHash = pending.hash as unknown as Parameters<typeof client.getTransaction>[0]['hash'];
  return verifySubmittedDeployment(client, client, typedHash, pending.hash, account, onProgress);
}

async function verifySubmittedDeployment(
  client: SkillForgeClient,
  readClient: SkillForgeClient,
  typedHash: Parameters<SkillForgeClient['getTransaction']>[0]['hash'],
  hash: string,
  account: Address,
  onProgress?: (progress: TransactionProgress) => void,
) {
  const receipt = await waitForFinalizedTransaction(
    hash,
    () => client.getTransaction({ hash: typedHash }),
    onProgress,
  );
  const receiptData = (receipt as { data?: { contract_address?: unknown } }).data;
  const address = receiptData?.contract_address;
  if (typeof address !== 'string' || !/^0x[0-9a-f]{40}$/i.test(address)) {
    clearPendingDeployment();
    throw new Error(`Transaction ${hash} finalized successfully but has no deployment address, so it did not create a contract. The saved attempt is cleared; verify the site and network before starting a new deployment.`);
  }
  // Keep GenLayer's checksummed deployment address. The RPC's contract reader
  // currently treats an all-lowercase address as a different lookup key.
  const normalizedAddress = address as Address;
  const deployedProtocol = await readClient.readContract({
    address: normalizedAddress,
    functionName: 'get_protocol',
    args: [],
    jsonSafeReturn: true,
  });
  const protocol = deployedProtocol as { protocol?: unknown; owner?: unknown };
  if (protocol.protocol !== 'skillforge-v1' || String(protocol.owner).toLowerCase() !== account) {
    throw new Error(`The deployment at ${normalizedAddress} did not match SkillForge v1 or the connected owner. The transaction is saved and must be reviewed before another deployment. Transaction: ${hash}`);
  }
  window.localStorage.setItem(DEPLOYMENT_STORAGE_KEY, normalizedAddress);
  clearPendingDeployment();
  return { hash, address: normalizedAddress };
}

export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
