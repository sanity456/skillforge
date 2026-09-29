import deployment from './deployment.json';
import { waitForFinalizedTransaction, type TransactionProgress } from './transactions.ts';

export const CHAIN_ID = 61999;
export const RPC = 'https://studio.genlayer.com/api';

export type Address = `0x${string}`;
type Provider = {
  request(request: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

const DEPLOYMENT_STORAGE_KEY = 'skillforge.studionet.contract.v1';

export function getDeploymentAddress(): Address | null {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
    if (saved && /^0x[0-9a-f]{40}$/i.test(saved)) return saved.toLowerCase() as Address;
  }
  const configuredAddress: unknown = deployment.address;
  return typeof configuredAddress === 'string' && /^0x[0-9a-f]{40}$/i.test(configuredAddress)
    ? configuredAddress.toLowerCase() as Address
    : null;
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
  onProgress?.({ hash: String(hash), status: 'SUBMITTED' });
  const receipt = await waitForFinalizedTransaction(
    String(hash),
    () => client.getTransaction({ hash: typedHash }),
    onProgress,
  );
  const receiptData = (receipt as { data?: { contract_address?: unknown } }).data;
  const address = receiptData?.contract_address;
  if (typeof address !== 'string' || !/^0x[0-9a-f]{40}$/i.test(address)) {
    throw new Error(`Deployment finalized but the contract address was missing from its receipt. Transaction: ${String(hash)}`);
  }
  const normalizedAddress = address.toLowerCase() as Address;
  const deployedProtocol = await client.readContract({
    address: normalizedAddress,
    functionName: 'get_protocol',
    args: [],
    jsonSafeReturn: true,
  });
  const protocol = deployedProtocol as { protocol?: unknown; owner?: unknown };
  if (protocol.protocol !== 'skillforge-v1' || String(protocol.owner).toLowerCase() !== account) {
    throw new Error(`The deployed contract did not match SkillForge v1 or the connected owner. Transaction: ${String(hash)}`);
  }
  window.localStorage.setItem(DEPLOYMENT_STORAGE_KEY, normalizedAddress);
  return { hash: String(hash), address: normalizedAddress };
}

export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
