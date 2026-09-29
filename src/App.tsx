import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronLeft,
  CircleCheck,
  Compass,
  Flame,
  Hammer,
  LayoutGrid,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import contractSource from '../contracts/skillforge.py?raw';
import { starterChallenges, type Challenge } from './catalog.ts';
import {
  CHAIN_ID,
  connect,
  deploySkillForge,
  getDeploymentAddress,
  hasDeployment,
  provider,
  readContract,
  shortAddress,
  switchToStudionet,
  walletState,
  writeContract,
  type Address,
} from './chain/client.ts';
import type { TransactionProgress } from './chain/transactions.ts';

type View = 'explore' | 'profile' | 'studio';
type ProfileData = {
  wallet: string;
  credentials: Array<Record<string, unknown>>;
  attempts: Array<Record<string, unknown>>;
  submissions: Array<Record<string, unknown>>;
};
type ProtocolData = { owner: string; protocol: string };

const nav = [
  { id: 'explore' as const, label: 'Explore', icon: Compass },
  { id: 'profile' as const, label: 'My proof', icon: Award },
  { id: 'studio' as const, label: 'Creator studio', icon: LayoutGrid },
];

function Logo() {
  return (
    <div className="brand" aria-label="SkillForge home">
      <span className="brand-mark"><Hammer size={22} strokeWidth={2.4} /></span>
      <span>Skill<span>Forge</span></span>
    </div>
  );
}

function fromChain(value: unknown): Challenge[] {
  if (!Array.isArray(value)) throw new Error('The contract returned an invalid challenge list.');
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error('The contract returned an invalid challenge.');
    const raw = entry as Partial<Challenge>;
    const sample = starterChallenges.find((challenge) => challenge.id === raw.id);
    const criteria = Array.isArray(raw.criteria) ? raw.criteria.filter((item): item is string => typeof item === 'string') : [];
    if (!raw.id || !raw.title || !raw.brief || criteria.length !== 4) throw new Error('A published challenge is missing required fields.');
    return {
      ...(sample ?? starterChallenges[0]),
      ...raw,
      id: raw.id,
      title: raw.title,
      category: raw.category ?? 'General',
      brief: raw.brief,
      criteria,
      pass_mark: Number(raw.pass_mark),
      max_attempts: Number(raw.max_attempts),
      status: raw.status ?? 'DRAFT',
      accent: sample?.accent ?? ['#b7f36b', '#ff8f5c', '#8d7cff'][index % 3],
      mark: sample?.mark ?? String(index + 1).padStart(2, '0'),
    };
  });
}

function ChallengeCard({ challenge, onOpen }: { challenge: Challenge; onOpen: () => void }) {
  return (
    <article className="challenge-card" style={{ '--accent': challenge.accent } as React.CSSProperties}>
      <div className="card-topline"><span className="category">{challenge.category}</span><span className="challenge-number">{challenge.mark}</span></div>
      <div className="card-orbit" aria-hidden="true"><span>{challenge.mark}</span></div>
      <h3>{challenge.title}</h3><p>{challenge.brief}</p>
      <div className="card-meta"><span>{challenge.difficulty}</span><i /><span>{challenge.time}</span><i /><span>{challenge.pass_mark}% to pass</span></div>
      <button className="card-action" onClick={onOpen}>Open challenge <ArrowRight size={18} /></button>
    </article>
  );
}

function Explore({ challenges, preview, loading, onSelect, onSetup }: {
  challenges: Challenge[]; preview: boolean; loading: boolean;
  onSelect: (challenge: Challenge) => void; onSetup: () => void;
}) {
  const openChallenges = challenges.filter((challenge) => challenge.status === 'OPEN');
  return <>
    <section className="hero">
      <div className="eyebrow"><Sparkles size={15} /> Practical proof, owned by you</div>
      <h1>Work worth<br /><em>proving.</em></h1>
      <p className="hero-copy">Complete real-world challenges. Get evaluated by independent validators. Carry the proof in your wallet.</p>
      <div className="hero-actions">
        {openChallenges[0] && <button className="primary" onClick={() => onSelect(openChallenges[0])}>Take your first challenge <ArrowRight size={18} /></button>}
        {!openChallenges.length && !preview && !loading && <button className="primary" onClick={onSetup}>Set up a challenge <ArrowRight size={18} /></button>}
        <a href="#how-it-works" className="text-link">See how it works</a>
      </div>
      <div className="hero-proof" aria-label="Product principles"><span><ShieldCheck size={18} /> Validator checked</span><span><LockKeyhole size={18} /> Rubric locked</span><span><Wallet size={18} /> Wallet owned</span></div>
      <div className="hero-glyph" aria-hidden="true"><div className="glyph-ring ring-one" /><div className="glyph-ring ring-two" /><div className="glyph-core"><Hammer size={44} /></div><span className="spark one">✦</span><span className="spark two">✦</span></div>
    </section>
    <section className="challenge-section" id="challenges">
      <div className="section-heading"><div><span className="kicker">{preview ? 'Preview challenges' : 'On-chain challenges'}</span><h2>{preview ? 'Explore the challenge format' : 'Choose what you want to prove'}</h2></div><p>{preview ? 'These examples become active after SkillForge is deployed and an owner publishes them.' : 'Challenge details and rubrics are loaded from the deployed contract.'}</p></div>
      {loading ? <p className="notice" role="status">Loading challenges from GenLayer…</p> : openChallenges.length ? <div className="challenge-grid">{openChallenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} onOpen={() => onSelect(challenge)} />)}</div> : <div className="empty small"><BookOpen size={32} /><h2>No open challenges</h2><p>{preview ? 'Deploy SkillForge, then publish a challenge from Creator Studio.' : 'The owner has not published an open challenge yet.'}</p>{preview && <button className="primary" onClick={onSetup}>Open Creator Studio</button>}</div>}
    </section>
    <section className="how" id="how-it-works"><div className="how-copy"><span className="kicker">The forge</span><h2>Skill becomes evidence in three clear steps.</h2></div><ol><li><span>1</span><div><b>Take the brief</b><p>Read the public task, rubric and passing threshold.</p></div></li><li><span>2</span><div><b>Show your work</b><p>Submit from your wallet with clear public-data consent.</p></div></li><li><span>3</span><div><b>Earn the proof</b><p>Independent validators agree before a credential is issued.</p></div></li></ol></section>
  </>;
}

function ChallengeDetail({ challenge, account, chainId, preview, onBack, onConnect, onSetup, onError, onProgress, onProfileRefresh }: {
  challenge: Challenge; account: Address | null; chainId: number | null; preview: boolean;
  onBack: () => void; onConnect: () => void; onSetup: () => void; onError: (message: string) => void;
  onProgress: (progress: TransactionProgress) => void; onProfileRefresh: () => void;
}) {
  const [work, setWork] = useState('');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const workBytes = new TextEncoder().encode(work).length;
  const ready = Boolean(account && chainId === CHAIN_ID && !preview && challenge.status === 'OPEN' && consent && workBytes >= 40 && workBytes <= 5000);

  async function submit() {
    if (!account || !ready) return;
    setBusy(true); setMessage('Confirm in your wallet. Then wait for validator consensus to finish.');
    const requestKey = `skillforge.request.${challenge.id}.${account}.${await digest(work.trim())}`;
    let requestId = window.localStorage.getItem(requestKey);
    if (!requestId) {
      requestId = `web-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
      window.localStorage.setItem(requestKey, requestId);
    }
    try {
      const { hash } = await writeContract(account, 'submit_work', [challenge.id, work.trim(), requestId, true], (progress) => {
        onProgress(progress);
        setMessage(progress.status === 'SUBMITTED' ? 'Transaction sent. Waiting for GenLayer validators…' : `Transaction ${progress.status.toLowerCase()}. Waiting for the final result…`);
      });
      const profile = await readContract('get_profile', [account]) as ProfileData;
      const submission = profile.submissions?.[profile.submissions.length - 1];
      if (!submission) throw new Error(`The transaction finalized, but its submission record could not be loaded. Transaction: ${hash}`);
      window.localStorage.removeItem(requestKey);
      onError('');
      const assessment = submission.assessment as Record<string, unknown> | undefined;
      const score = assessment?.total;
      setMessage(`Finalized: ${String(submission.verdict).replaceAll('_', ' ')}${typeof score === 'number' ? ` · ${score}/100` : ''} · ${String(submission.reason_code).replaceAll('_', ' ')} · ${shortAddress(hash)}`);
      onProfileRefresh();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Submission could not be completed.';
      setMessage(messageText); onError(messageText);
    } finally { setBusy(false); }
  }

  return <main className="detail-shell">
    <button className="back" onClick={onBack}><ChevronLeft size={18} /> All challenges</button>
    <div className="detail-grid">
      <section className="brief-panel"><div className="detail-label"><span style={{ background: challenge.accent }} /> {challenge.category} · {preview ? 'PREVIEW' : challenge.status}</div><h1>{challenge.title}</h1><p className="brief">{challenge.brief}</p><div className="fact-row"><span>{challenge.difficulty}</span><span>{challenge.time}</span><span>{challenge.max_attempts} attempts</span></div><h2>What validators check</h2><ul className="criteria">{challenge.criteria.map((criterion, index) => <li key={criterion}><span>{index + 1}</span>{criterion}</li>)}</ul><div className="rubric-lock"><LockKeyhole size={19} /><div><b>Rubric locked before submission</b><p>Each criterion is worth 25 points. You need {challenge.pass_mark}/100 and no critical failure.</p></div></div></section>
      <section className="work-panel"><div className="work-heading"><span>Your response</span><small>{workBytes.toLocaleString()} / 5,000 bytes</small></div><textarea value={work} onChange={(event) => { const next = event.target.value; if (new TextEncoder().encode(next).length <= 5000) setWork(next); }} placeholder="Write your answer here. Validators only judge the text you submit…" aria-label="Your response" />
        <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><b>I understand this submission is public.</b><small>Do not include private, identifying or confidential information.</small></span></label>
        {preview ? <button className="primary full" onClick={onSetup}><Flame size={18} /> Deploy SkillForge to test</button> : !account ? <button className="primary full" onClick={onConnect}><Wallet size={18} /> Connect wallet to continue</button> : chainId !== CHAIN_ID ? <button className="primary full" onClick={() => void switchToStudionet().catch((error) => onError(error instanceof Error ? error.message : 'Could not switch to Studionet.'))}><Wallet size={18} /> Switch to Studionet</button> : <button className="primary full" disabled={!ready || busy} onClick={() => void submit()}>{busy ? 'Waiting for validators…' : 'Submit for evaluation'} <ArrowRight size={18} /></button>}
        {message && <p className="notice" role="status">{message}</p>}<div className="transaction-note"><ShieldCheck size={17} /><span>This action calls SkillForge with <b>0 GEN</b>. Network gas may still apply.</span></div>
      </section>
    </div>
  </main>;
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (item) => item.toString(16).padStart(2, '0')).join('');
}

function Profile({ account, profile, loading, error, onConnect }: { account: Address | null; profile: ProfileData | null; loading: boolean; error: string; onConnect: () => void }) {
  if (!account) return <main className="subpage"><span className="kicker">Wallet-owned progress</span><h1>My proof</h1><div className="empty"><div className="empty-icon"><UserRound size={34} /></div><h2>Your work deserves a home.</h2><p>Connect the wallet you use for challenges to see earned credentials and attempts.</p><button className="primary" onClick={onConnect}><Wallet size={18} /> Connect wallet</button></div></main>;
  const credentials = profile?.credentials ?? [];
  const submissions = profile?.submissions ?? [];
  return <main className="subpage"><span className="kicker">Wallet-owned progress</span><h1>My proof</h1><section className="profile-card"><div className="avatar"><Hammer /></div><span>Connected learner</span><h2>{shortAddress(account)}</h2><p>Challenge attempts and credentials recorded for this wallet.</p></section>
    <section className="activity-panel"><div className="section-heading"><div><span className="kicker">Earned on GenLayer</span><h2>Credentials</h2></div></div>{loading ? <p role="status">Loading your profile…</p> : error ? <p className="notice" role="alert">{error}</p> : credentials.length ? <div className="credential-grid">{credentials.map((item, index) => <article className="credential-card" key={String(item.id ?? index)}><Award size={23} /><span>{String(item.category ?? 'SkillForge')}</span><h3>{String(item.title ?? item.challenge_id)}</h3><p>{String(item.score ?? 0)}/100 · {String(item.challenge_version ?? 'v1')}</p><code>{String(item.rubric_hash ?? '').slice(0, 16)}…</code></article>)}</div> : <p>No credentials yet. Pass an open challenge to earn your first record.</p>}</section>
    <section className="activity-panel"><div className="section-heading"><div><span className="kicker">Public record</span><h2>Submission history</h2></div></div>{loading ? <p>Loading submissions…</p> : submissions.length ? <div className="submission-list">{[...submissions].reverse().map((item, index) => { const assessment = item.assessment as Record<string, unknown> | undefined; return <article className="submission-row" key={String(item.id ?? index)}><div><b>{String(item.title ?? item.challenge_id)}</b><small>Attempt {String(item.attempt)} · {String(item.recorded_at)}</small></div><span>{String(assessment?.total ?? '—')}/100</span><strong className={item.verdict === 'CREDENTIAL_EARNED' ? 'success' : 'muted'}>{String(item.verdict).replaceAll('_', ' ')}</strong><small>{String(item.reason_code).replaceAll('_', ' ')}</small></article>; })}</div> : <p>No submissions yet.</p>}</section>
  </main>;
}

type ChallengeForm = { id: string; title: string; category: string; brief: string; criteria: string[]; passMark: string; maxAttempts: string };
const emptyForm = (): ChallengeForm => ({ id: '', title: '', category: '', brief: '', criteria: ['', '', '', ''], passMark: '70', maxAttempts: '3' });

function Studio({ account, chainId, owner, challenges, preview, onConnect, onRefresh, onDeployed, onError }: {
  account: Address | null; chainId: number | null; owner: string | null; challenges: Challenge[]; preview: boolean;
  onConnect: () => void; onRefresh: () => Promise<void>; onDeployed: () => void; onError: (message: string) => void;
}) {
  const [form, setForm] = useState<ChallengeForm>(emptyForm);
  const [challengeConsent, setChallengeConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const isOwner = Boolean(account && owner && account.toLowerCase() === owner.toLowerCase());

  async function deploy() {
    if (!account) return onConnect();
    if (chainId !== CHAIN_ID) {
      try { await switchToStudionet(); } catch (error) { onError(error instanceof Error ? error.message : 'Could not switch to Studionet.'); }
      return;
    }
    setBusy(true); setMessage('Confirm deployment in your wallet. Waiting for GenLayer validators…');
    try {
      const deployed = await deploySkillForge(account, contractSource, (progress) => setMessage(`Deployment ${progress.status.toLowerCase()}… keep this page open.`));
      setMessage(`SkillForge deployed at ${deployed.address}. You are its owner.`); onDeployed();
    } catch (error) { const text = error instanceof Error ? error.message : 'Deployment failed.'; setMessage(text); onError(text); }
    finally { setBusy(false); }
  }

  async function createAndPublish() {
    if (!account || !isOwner || !challengeConsent || !form.id || !form.title || !form.category || !form.brief || form.criteria.some((item) => !item.trim())) return;
    setBusy(true); setMessage('Confirm challenge creation in your wallet…');
    try {
      const args = [form.id.trim().toLowerCase(), form.title.trim(), form.category.trim(), form.brief.trim(), ...form.criteria.map((item) => item.trim()), Number(form.passMark), Number(form.maxAttempts), true];
      await writeContract(account, 'create_challenge', args, (progress) => setMessage(`Challenge creation ${progress.status.toLowerCase()}…`));
      setMessage('Challenge created. Confirm the publish action in your wallet…');
      await writeContract(account, 'publish_challenge', [form.id.trim().toLowerCase()], (progress) => setMessage(`Publishing ${progress.status.toLowerCase()}…`));
      setMessage('Challenge published and open for wallet testing.'); setForm(emptyForm()); setChallengeConsent(false); await onRefresh();
    } catch (error) { const text = error instanceof Error ? error.message : 'Challenge could not be published.'; setMessage(text); onError(text); await onRefresh(); }
    finally { setBusy(false); }
  }

  async function closeChallenge(id: string) {
    if (!account || !isOwner) return;
    setBusy(true); setMessage('Confirm challenge closure in your wallet…');
    try { await writeContract(account, 'close_challenge', [id], (progress) => setMessage(`Closing ${progress.status.toLowerCase()}…`)); setMessage('Challenge closed.'); await onRefresh(); }
    catch (error) { const text = error instanceof Error ? error.message : 'Challenge could not be closed.'; setMessage(text); onError(text); }
    finally { setBusy(false); }
  }

  return <main className="subpage">
    <span className="kicker">Curated challenge publishing</span><h1>Creator studio</h1>
    {preview ? <div className="deploy-panel"><div><h2>Deploy SkillForge to Studionet</h2><p>The connected wallet becomes the contract owner. Confirm the deployment in your wallet; the contract accepts no funds.</p></div><button className="primary" disabled={busy} onClick={() => void deploy()}><Flame size={18} />{busy ? 'Waiting for validators…' : chainId !== null && chainId !== CHAIN_ID ? 'Switch to Studionet' : 'Deploy SkillForge'}</button></div> : <>
      <div className="studio-intro"><div><h2>Turn a real task into public proof.</h2><p>SkillForge locks the brief, four criteria, pass mark and attempt limit before a challenge opens.</p>{owner && <small>Contract owner: {shortAddress(owner)} · Connected wallet: {account ? shortAddress(account) : 'not connected'}</small>}</div>{!account && <button className="secondary" onClick={onConnect}><Wallet size={17} /> Connect wallet</button>}</div>
      {isOwner && <section className="creator-form"><h2><Plus size={19} /> Create and publish a challenge</h2><p>Creation and publishing are separate finalized wallet transactions.</p><div className="form-grid"><label>Challenge ID<input value={form.id} maxLength={64} onChange={(event) => setForm({ ...form, id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="customer-support-v1" /></label><label>Title<input value={form.title} maxLength={100} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Category<input value={form.category} maxLength={40} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label>Pass mark<input type="number" min="50" max="95" step="1" value={form.passMark} onChange={(event) => setForm({ ...form, passMark: event.target.value })} /></label><label>Attempts per wallet<input type="number" min="1" max="10" step="1" value={form.maxAttempts} onChange={(event) => setForm({ ...form, maxAttempts: event.target.value })} /></label></div><label className="form-label">Brief<textarea value={form.brief} maxLength={1800} onChange={(event) => setForm({ ...form, brief: event.target.value })} /></label><div className="criteria-editor"><b>Four published criteria</b>{form.criteria.map((criterion, index) => <label key={index}>Criterion {index + 1}<input value={criterion} maxLength={400} onChange={(event) => setForm({ ...form, criteria: form.criteria.map((item, criterionIndex) => criterionIndex === index ? event.target.value : item) })} /></label>)}</div><label className="consent"><input type="checkbox" checked={challengeConsent} onChange={(event) => setChallengeConsent(event.target.checked)} /><span><b>I understand challenge details are public.</b><small>Confirm this brief and rubric are safe to store permanently on-chain.</small></span></label><button className="primary" disabled={busy || !challengeConsent || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(form.id) || !form.title.trim() || !form.category.trim() || !form.brief.trim() || new TextEncoder().encode(form.title.trim()).length > 100 || new TextEncoder().encode(form.category.trim()).length > 40 || new TextEncoder().encode(form.brief.trim()).length > 1800 || form.criteria.some((item) => !item.trim() || new TextEncoder().encode(item.trim()).length > 400) || !Number.isInteger(Number(form.passMark)) || Number(form.passMark) < 50 || Number(form.passMark) > 95 || !Number.isInteger(Number(form.maxAttempts)) || Number(form.maxAttempts) < 1 || Number(form.maxAttempts) > 10} onClick={() => void createAndPublish()}>{busy ? 'Waiting for validators…' : 'Create & publish'} <ArrowRight size={18} /></button></section>}
      {account && !isOwner && <p className="notice" role="status">Only the deploying wallet can create or close challenges. Connect the owner wallet {owner ? shortAddress(owner) : ''}.</p>}
      <section className="studio-challenges"><h2>Challenges on this contract</h2>{challenges.length ? challenges.map((challenge) => <article className="studio-challenge" key={challenge.id}><div><b>{challenge.title}</b><small>{challenge.id} · {challenge.category} · {challenge.pass_mark}/100 · {challenge.max_attempts} attempts</small></div><span className={`challenge-status ${challenge.status.toLowerCase()}`}>{challenge.status}</span>{challenge.status === 'DRAFT' && isOwner && <button className="secondary" disabled={busy} onClick={() => void writeContract(account!, 'publish_challenge', [challenge.id], (progress) => setMessage(`Publishing ${progress.status.toLowerCase()}…`)).then(onRefresh).catch((error) => onError(error instanceof Error ? error.message : 'Publish failed.'))}>Publish</button>}{challenge.status === 'OPEN' && isOwner && <button className="secondary" disabled={busy} onClick={() => void closeChallenge(challenge.id)}>Close</button>}</article>) : <p>No on-chain challenges yet.</p>}</section>
    </>}
    {message && <p className="notice" role="status">{message}</p>}
  </main>;
}

export function App() {
  const [view, setView] = useState<View>('explore');
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletError, setWalletError] = useState('');
  const [challenges, setChallenges] = useState<Challenge[]>(starterChallenges);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [preview, setPreview] = useState(!hasDeployment());
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [deploymentVersion, setDeploymentVersion] = useState(0);

  const refreshChallenges = useCallback(async () => {
    if (!hasDeployment()) { setPreview(true); setChallenges(starterChallenges); setOwner(null); return; }
    setLoadingChallenges(true); setPreview(false);
    try {
      const [rawChallenges, rawProtocol] = await Promise.all([readContract('list_challenges'), readContract('get_protocol')]);
      const protocol = rawProtocol as ProtocolData;
      if (protocol.protocol !== 'skillforge-v1') throw new Error('The configured contract is not SkillForge v1.');
      setOwner(String(protocol.owner).toLowerCase()); setChallenges(fromChain(rawChallenges));
    } catch (error) { setWalletError(error instanceof Error ? error.message : 'Could not load the SkillForge contract.'); }
    finally { setLoadingChallenges(false); }
  }, [deploymentVersion]);

  const refreshProfile = useCallback(async () => {
    if (!account || !hasDeployment()) { setProfile(null); return; }
    setLoadingProfile(true); setProfileError('');
    try { setProfile(await readContract('get_profile', [account]) as ProfileData); }
    catch (error) { setProfileError(error instanceof Error ? error.message : 'Could not load this wallet profile.'); }
    finally { setLoadingProfile(false); }
  }, [account, deploymentVersion]);

  useEffect(() => { void refreshChallenges(); }, [refreshChallenges]);
  useEffect(() => { void refreshProfile(); }, [refreshProfile]);

  const refreshWallet = useCallback(async () => {
    const p = provider(); if (!p) return;
    const state = await walletState(p); setAccount(state.account); setChainId(state.chainId);
  }, []);
  useEffect(() => {
    void refreshWallet().catch((error) => setWalletError(error instanceof Error ? error.message : 'Could not read wallet state.'));
    const p = provider(); if (!p?.on) return;
    const change = () => void refreshWallet().catch((error) => setWalletError(error instanceof Error ? error.message : 'Could not read wallet state.'));
    p.on('accountsChanged', change); p.on('chainChanged', change);
    return () => { p.removeListener?.('accountsChanged', change); p.removeListener?.('chainChanged', change); };
  }, [refreshWallet]);

  async function connectWallet() {
    setWalletError('');
    try { const state = await connect(); setAccount(state.account); setChainId(state.chainId); }
    catch (error) { setWalletError(error instanceof Error ? error.message : 'Wallet connection failed.'); }
  }
  const walletLabel = useMemo(() => account ? shortAddress(account) : 'Connect wallet', [account]);
  const navigate = (nextView: View) => { setSelected(null); setView(nextView); };
  const handleProgress = (progress: TransactionProgress) => { if (progress.status === 'SUBMITTED') setWalletError('Transaction sent. Waiting for GenLayer validators; do not submit it again.'); else setWalletError(`Transaction ${progress.status.toLowerCase()}. Waiting for its final result…`); };
  const deployedNow = hasDeployment();
  const onDeployed = () => { setDeploymentVersion((version) => version + 1); setWalletError(''); };

  return <div className="app-shell">
    <Header view={view} setView={navigate} walletLabel={walletLabel} chainId={chainId} connectWallet={connectWallet} />
    {walletError && <div className="error-banner" role="alert"><X size={16} /> {walletError}</div>}
    {selected ? <ChallengeDetail challenge={selected} account={account} chainId={chainId} preview={preview} onBack={() => setSelected(null)} onConnect={() => void connectWallet()} onSetup={() => navigate('studio')} onError={setWalletError} onProgress={handleProgress} onProfileRefresh={() => void refreshProfile()} /> : view === 'explore' ? <Explore challenges={challenges} preview={preview} loading={loadingChallenges} onSelect={setSelected} onSetup={() => navigate('studio')} /> : view === 'profile' ? <Profile account={account} profile={profile} loading={loadingProfile} error={profileError} onConnect={() => void connectWallet()} /> : <Studio account={account} chainId={chainId} owner={owner} challenges={challenges} preview={!deployedNow} onConnect={() => void connectWallet()} onRefresh={refreshChallenges} onDeployed={onDeployed} onError={setWalletError} />}
    <footer><Logo /><p>Proof of work, shaped by consensus.</p><span>GenLayer Studionet · v1</span></footer>
  </div>;
}

function Header({ view, setView, walletLabel, chainId, connectWallet }: { view: View; setView: (view: View) => void; walletLabel: string; chainId: number | null; connectWallet: () => Promise<void> }) {
  const network = chainId === CHAIN_ID ? 'GenLayer Studionet' : chainId === null ? 'Connect wallet' : 'Switch to Studionet';
  return <header><button className="logo-button" aria-label="SkillForge home" onClick={() => setView('explore')}><Logo /></button><nav aria-label="Main navigation">{nav.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><item.icon size={17} />{item.label}</button>)}</nav><div className={`network ${chainId === null ? '' : chainId === CHAIN_ID ? 'connected' : 'wrong'}`}><i /> {network}</div><button className="wallet-button" onClick={() => void connectWallet()}><Wallet size={17} /> {walletLabel}</button></header>;
}
