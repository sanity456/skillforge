import { useEffect, useMemo, useState } from 'react';
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
import { starterChallenges, type Challenge } from './catalog.ts';
import {
  CHAIN_ID,
  connect,
  hasDeployment,
  provider,
  shortAddress,
  switchToStudionet,
  walletState,
  writeContract,
  type Address,
} from './chain/client.ts';

type View = 'explore' | 'profile' | 'studio';

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

function ChallengeCard({ challenge, onOpen }: { challenge: Challenge; onOpen: () => void }) {
  return (
    <article className="challenge-card" style={{ '--accent': challenge.accent } as React.CSSProperties}>
      <div className="card-topline">
        <span className="category">{challenge.category}</span>
        <span className="challenge-number">{challenge.mark}</span>
      </div>
      <div className="card-orbit" aria-hidden="true"><span>{challenge.mark}</span></div>
      <h3>{challenge.title}</h3>
      <p>{challenge.brief}</p>
      <div className="card-meta">
        <span>{challenge.difficulty}</span><i />
        <span>{challenge.time}</span><i />
        <span>{challenge.pass_mark}% to pass</span>
      </div>
      <button className="card-action" onClick={onOpen}>
        Open challenge <ArrowRight size={18} />
      </button>
    </article>
  );
}

function Explore({ onSelect }: { onSelect: (challenge: Challenge) => void }) {
  return (
    <>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={15} /> Practical proof, owned by you</div>
        <h1>Work worth<br /><em>proving.</em></h1>
        <p className="hero-copy">
          Complete real-world challenges. Get evaluated by independent validators.
          Carry the proof in your wallet.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={() => onSelect(starterChallenges[0])}>
            Take your first challenge <ArrowRight size={18} />
          </button>
          <a href="#how-it-works" className="text-link">See how it works</a>
        </div>
        <div className="hero-proof" aria-label="Product principles">
          <span><ShieldCheck size={18} /> Validator checked</span>
          <span><LockKeyhole size={18} /> Rubric locked</span>
          <span><Wallet size={18} /> Wallet owned</span>
        </div>
        <div className="hero-glyph" aria-hidden="true">
          <div className="glyph-ring ring-one" /><div className="glyph-ring ring-two" />
          <div className="glyph-core"><Hammer size={44} /></div>
          <span className="spark one">✦</span><span className="spark two">✦</span>
        </div>
      </section>

      <section className="challenge-section" id="challenges">
        <div className="section-heading">
          <div><span className="kicker">Live paths</span><h2>Choose what you want to prove</h2></div>
          <p>Every challenge publishes its evidence, criteria and attempt limit before you begin.</p>
        </div>
        <div className="challenge-grid">
          {starterChallenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} onOpen={() => onSelect(challenge)} />
          ))}
        </div>
      </section>

      <section className="how" id="how-it-works">
        <div className="how-copy"><span className="kicker">The forge</span><h2>Skill becomes evidence in three clear steps.</h2></div>
        <ol>
          <li><span>1</span><div><b>Take the brief</b><p>Read the public task, rubric and passing threshold.</p></div></li>
          <li><span>2</span><div><b>Show your work</b><p>Submit from your wallet with clear public-data consent.</p></div></li>
          <li><span>3</span><div><b>Earn the proof</b><p>Independent validators agree before a credential is issued.</p></div></li>
        </ol>
      </section>
    </>
  );
}

function ChallengeDetail({ challenge, account, chainId, onBack, onConnect }: {
  challenge: Challenge; account: Address | null; chainId: number | null; onBack: () => void; onConnect: () => void;
}) {
  const [work, setWork] = useState('');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = account && chainId === CHAIN_ID && hasDeployment && consent && work.trim().length >= 40;

  async function submit() {
    if (!account || !ready) return;
    setBusy(true); setMessage('Check your wallet. The contract call sends 0 GEN.');
    try {
      const requestId = `web-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
      const hash = await writeContract(account, 'submit_work', [challenge.id, work.trim(), requestId, true]);
      setMessage(`Submitted: ${String(hash).slice(0, 14)}… Track it in wallet Activity.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Submission could not be started.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="detail-shell">
      <button className="back" onClick={onBack}><ChevronLeft size={18} /> All challenges</button>
      <div className="detail-grid">
        <section className="brief-panel">
          <div className="detail-label"><span style={{ background: challenge.accent }} /> {challenge.category}</div>
          <h1>{challenge.title}</h1>
          <p className="brief">{challenge.brief}</p>
          <div className="fact-row"><span>{challenge.difficulty}</span><span>{challenge.time}</span><span>{challenge.max_attempts} attempts</span></div>
          <h2>What validators check</h2>
          <ul className="criteria">
            {challenge.criteria.map((criterion, index) => <li key={criterion}><span>{index + 1}</span>{criterion}</li>)}
          </ul>
          <div className="rubric-lock"><LockKeyhole size={19} /><div><b>Rubric locked before submission</b><p>Each criterion is worth 25 points. You need {challenge.pass_mark}/100 and no critical failure.</p></div></div>
        </section>
        <section className="work-panel">
          <div className="work-heading"><span>Your response</span><small>{new TextEncoder().encode(work).length} / 5,000 bytes</small></div>
          <textarea value={work} onChange={(event) => setWork(event.target.value)} maxLength={5000} placeholder="Write your answer here. Validators only judge the text you submit…" />
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span><b>I understand this submission is public.</b><small>Do not include private, identifying or confidential information.</small></span>
          </label>
          {!account ? (
            <button className="primary full" onClick={onConnect}><Wallet size={18} /> Connect wallet to continue</button>
          ) : chainId !== CHAIN_ID ? (
            <button className="primary full" onClick={() => void switchToStudionet()}><Wallet size={18} /> Switch to Studionet</button>
          ) : !hasDeployment ? (
            <button className="primary full" disabled><Flame size={18} /> Studionet activation is next</button>
          ) : (
            <button className="primary full" disabled={!ready || busy} onClick={() => void submit()}>{busy ? 'Opening wallet…' : 'Submit for evaluation'} <ArrowRight size={18} /></button>
          )}
          {message && <p className="notice" role="status">{message}</p>}
          <div className="transaction-note"><ShieldCheck size={17} /><span>This action calls SkillForge with <b>0 GEN</b>. Network gas may still apply.</span></div>
        </section>
      </div>
    </main>
  );
}

function Profile({ account, onConnect }: { account: Address | null; onConnect: () => void }) {
  return (
    <main className="subpage">
      <span className="kicker">Wallet-owned progress</span><h1>My proof</h1>
      {!account ? <div className="empty"><div className="empty-icon"><UserRound size={34} /></div><h2>Your work deserves a home.</h2><p>Connect the wallet you use for challenges to see earned credentials and attempts.</p><button className="primary" onClick={onConnect}><Wallet size={18} /> Connect wallet</button></div>
      : <div className="profile-grid"><section className="profile-card"><div className="avatar"><Hammer /></div><span>Connected learner</span><h2>{shortAddress(account)}</h2><p>Your public SkillForge record will appear here after the first accepted submission.</p></section><section className="empty small"><Award size={32} /><h2>No credentials yet</h2><p>Complete a live challenge to forge your first proof.</p></section></div>}
    </main>
  );
}

function Studio({ account, onConnect }: { account: Address | null; onConnect: () => void }) {
  return (
    <main className="subpage">
      <span className="kicker">Curated challenge publishing</span><h1>Creator studio</h1>
      <div className="studio-intro"><div><h2>Turn a real task into public proof.</h2><p>SkillForge locks the brief, four criteria, pass mark and attempt limit before a challenge opens.</p></div><button className="secondary" disabled={!account || !hasDeployment}><Plus size={18} /> New challenge</button></div>
      <div className="studio-table">
        <div className="table-head"><span>Challenge</span><span>Status</span><span>Pass mark</span><span>Attempts</span></div>
        {starterChallenges.map((challenge) => <div className="table-row" key={challenge.id}><span><i style={{ background: challenge.accent }} /> <b>{challenge.title}</b><small>{challenge.category}</small></span><span className="status"><CircleCheck size={15} /> Preview</span><span>{challenge.pass_mark}/100</span><span>{challenge.max_attempts}</span></div>)}
      </div>
      {!account && <div className="studio-connect"><BookOpen size={20} /><span>Connect the owner wallet to publish and manage challenges.</span><button onClick={onConnect}>Connect</button></div>}
    </main>
  );
}

export function App() {
  const [view, setView] = useState<View>('explore');
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletError, setWalletError] = useState('');

  async function refreshWallet() {
    const p = provider(); if (!p) return;
    const state = await walletState(p); setAccount(state.account); setChainId(state.chainId);
  }
  useEffect(() => {
    void refreshWallet();
    const p = provider(); if (!p?.on) return;
    const change = () => void refreshWallet(); p.on('accountsChanged', change); p.on('chainChanged', change);
    return () => { p.removeListener?.('accountsChanged', change); p.removeListener?.('chainChanged', change); };
  }, []);
  async function connectWallet() {
    setWalletError('');
    try { const state = await connect(); setAccount(state.account); setChainId(state.chainId); }
    catch (error) { setWalletError(error instanceof Error ? error.message : 'Wallet connection failed.'); }
  }
  const walletLabel = useMemo(() => account ? shortAddress(account) : 'Connect wallet', [account]);

  if (selected) return <><Header view={view} setView={setView} account={account} walletLabel={walletLabel} connectWallet={connectWallet} /><ChallengeDetail challenge={selected} account={account} chainId={chainId} onBack={() => setSelected(null)} onConnect={() => void connectWallet()} /></>;
  return (
    <div className="app-shell">
      <Header view={view} setView={setView} account={account} walletLabel={walletLabel} connectWallet={connectWallet} />
      {walletError && <div className="error-banner"><X size={16} /> {walletError}</div>}
      {view === 'explore' && <Explore onSelect={setSelected} />}
      {view === 'profile' && <Profile account={account} onConnect={() => void connectWallet()} />}
      {view === 'studio' && <Studio account={account} onConnect={() => void connectWallet()} />}
      <footer><Logo /><p>Proof of work, shaped by consensus.</p><span>GenLayer Studionet · v1 foundation</span></footer>
    </div>
  );
}

function Header({ view, setView, account, walletLabel, connectWallet }: { view: View; setView: (view: View) => void; account: Address | null; walletLabel: string; connectWallet: () => Promise<void> }) {
  return <header><button className="logo-button" onClick={() => setView('explore')}><Logo /></button><nav aria-label="Main navigation">{nav.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><item.icon size={17} />{item.label}</button>)}</nav><div className="network"><i /> Studionet</div><button className="wallet-button" onClick={() => void connectWallet()}><Wallet size={17} /> {walletLabel}{account && <Check size={14} />}</button></header>;
}
