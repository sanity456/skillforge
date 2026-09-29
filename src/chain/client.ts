import deployment from './deployment.json';

export const CHAIN_ID = 61999;
export const RPC = 'https://studio.genlayer.com/api';

export type Address = `0x${string}`;
type Provider = {
  request(request: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

export const hasDeployment =
  typeof deployment.address === 'string' && /^0x[0-9a-f]{40}$/i.test(deployment.address);

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
  if (!hasDeployment) throw new Error('SkillForge is ready for its first Studionet deployment.');
  const [{ createClient }, { studionet }] = await Promise.all([
    import('genlayer-js'),
    import('genlayer-js/chains'),
  ]);
  return createClient({ chain: studionet, endpoint: RPC });
}

export async function readContract(functionName: string, args: unknown[] = []) {
  const { TransactionHashVariant } = await import('genlayer-js/types');
  return (await publicClient()).readContract({
    address: deployment.address as unknown as Address,
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
) {
  if (!hasDeployment) throw new Error('SkillForge is ready for its first Studionet deployment.');
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
  return client.writeContract({
    address: deployment.address as unknown as Address,
    functionName,
    args: args as never[],
    value: 0n,
    leaderOnly: false,
  });
}

export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
