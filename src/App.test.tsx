import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.tsx';

afterEach(cleanup);

describe('SkillForge shell', () => {
  it('opens a challenge and displays the locked rubric', async () => {
    const page = render(<App />);
    await userEvent.click(page.getByRole('button', { name: /take your first challenge/i }));
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
});
