import { afterEach, describe, expect, it } from 'vitest';
import { getDeploymentAddress, getPendingDeployment } from './client.ts';

const deploymentKey = 'skillforge.studionet.contract.v1';
const pendingKey = 'skillforge.studionet.pending-deployment.v1';

afterEach(() => {
  window.localStorage.removeItem(deploymentKey);
  window.localStorage.removeItem(pendingKey);
});

describe('Studionet deployment storage', () => {
  it('preserves the checksummed contract address for RPC reads', () => {
    const checksumAddress = '0x2C9BFBCE8d68C7098e719cE23e49a9fe05a1d2Ae';
    window.localStorage.setItem(deploymentKey, checksumAddress);

    expect(getDeploymentAddress()).toBe(checksumAddress);
  });

  it('only accepts a pending deployment for the expected chain and valid identities', () => {
    const pending = {
      hash: `0x${'a'.repeat(64)}`,
      owner: '0x7Cef5DBbD598ba74EF9C665c9853E573448d97D0',
      chainId: 61999,
    };
    window.localStorage.setItem(pendingKey, JSON.stringify(pending));

    expect(getPendingDeployment()).toEqual({
      ...pending,
      owner: pending.owner.toLowerCase(),
    });

    window.localStorage.setItem(pendingKey, JSON.stringify({ ...pending, chainId: 61997 }));
    expect(getPendingDeployment()).toBeNull();
  });
});
