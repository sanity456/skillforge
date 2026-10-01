import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, Profile, fromChain } from './App.tsx';
import { starterChallenges } from './catalog.ts';
import * as chainClient from './chain/client.ts';

const readLiveContract = async (functionName: string) => functionName === 'list_challenges'
  ? starterChallenges
  : { protocol: 'skillforge-v1', owner: '0x7Cef5DBbD598ba74EF9C665c9853E573448d97D0' };

beforeEach(() => {
  vi.spyOn(chainClient, 'readContract').mockImplementation(readLiveContract);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SkillForge shell', () => {
  it('opens a challenge and displays the locked rubric', async () => {
    const page = render(<App />);
    await userEvent.click(await page.findByRole('button', { name: /take your first challenge/i }));
    expect(page.getByRole('heading', { name: 'Calm the refund storm' })).toBeTruthy();
    expect(page.getByText(/rubric locked before submission/i)).toBeTruthy();
    expect(page.getByText(/0 GEN/i)).toBeTruthy();
  });

  it('shows the wallet-owned profile empty state', async () => {
    const page = render(<App />);
    await userEvent.click(page.getByRole('button', { name: /my proof/i }));
    expect(page.getByRole('heading', { name: 'My proof' })).toBeTruthy();
    expect(page.getByText(/your work deserves a home/i)).toBeTruthy();
  });

  it('clears the selected challenge when the user switches sections', async () => {
    const page = render(<App />);
    await userEvent.click(await page.findByRole('button', { name: /take your first challenge/i }));
    expect(page.getByRole('button', { name: /all challenges/i })).toBeTruthy();
    await userEvent.click(page.getByRole('button', { name: /my proof/i }));
    expect(page.getByRole('heading', { name: 'My proof' })).toBeTruthy();
    expect(page.queryByRole('button', { name: /all challenges/i })).toBeNull();
  });

  it('uses the verified deployment manifest for live challenge mode', () => {
    const page = render(<App />);
    expect(page.getByText(/on-chain challenges/i)).toBeTruthy();
    expect(page.getByText(/loaded from the deployed contract/i)).toBeTruthy();
  });

  it('hides unverified starter cards on RPC failure and recovers on retry', async () => {
    vi.mocked(chainClient.readContract).mockRejectedValue(new Error('RPC unavailable'));
    const page = render(<App />);

    expect(await page.findByRole('heading', { name: 'Challenges unavailable' })).toBeTruthy();
    expect(page.getByText('RPC unavailable')).toBeTruthy();
    expect(page.queryByRole('button', { name: /take your first challenge/i })).toBeNull();
    expect(page.queryByRole('heading', { name: 'Calm the refund storm' })).toBeNull();

    await userEvent.click(page.getByRole('button', { name: /creator studio/i }));
    expect(page.getByText('RPC unavailable')).toBeTruthy();
    expect(page.queryByText('No on-chain challenges yet.')).toBeNull();

    vi.mocked(chainClient.readContract).mockImplementation(readLiveContract);
    await userEvent.click(page.getByRole('button', { name: 'Try again' }));
    expect(await page.findByText('Calm the refund storm')).toBeTruthy();
  });

  it('does not invent a difficulty or duration for a custom on-chain challenge', () => {
    const { difficulty: _difficulty, time: _time, ...onChain } = starterChallenges[0];
    const [challenge] = fromChain([{ ...onChain, id: 'custom-v1', title: 'Custom challenge' }]);

    expect(challenge.difficulty).toBe('Unrated');
    expect(challenge.time).toBe('No time limit');
  });

  it('shows the complete on-chain assessment behind an accessible scorecard', async () => {
    const wallet = '0x7Cef5DBbD598ba74EF9C665c9853E573448d97D0';
    const page = render(<Profile account={wallet} challenges={starterChallenges} loading={false} error="" onConnect={() => {}} profile={{
      wallet, credentials: [], attempts: [], submissions: [{
        id: 'submission-1', challenge_id: 'support-clarity-v1', title: 'Calm the refund storm',
        attempt: 1, recorded_at: '2026-10-01T11:39:33Z', verdict: 'CREDENTIAL_EARNED',
        reason_code: 'PASSED_THRESHOLD', rubric_hash: 'rubric-hash', work_hash: 'work-hash',
        assessment: { total: 95, scores: { criterion_1: 25, criterion_2: 24, criterion_3: 23, criterion_4: 23 }, summary: 'Clear response.', strength: 'Accurate policy.', improvement: 'Shorten the introduction.' },
      }],
    }} />);

    await userEvent.click(page.getByText('View full scorecard'));
    expect(page.getByText('25/25')).toBeTruthy();
    expect(page.getByText('24/25')).toBeTruthy();
    expect(page.getByText('Clear response.')).toBeTruthy();
    expect(page.getByText('Shorten the introduction.')).toBeTruthy();
    expect(page.getByText('submission-1')).toBeTruthy();
  });
});
