import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { LockKeyhole, Plus, Search, Settings2, Sun, Moon, Trash2, RotateCcw, PanelLeftClose, PanelLeftOpen, X, FileText, ChevronDown, ChevronRight, Pencil, List } from 'lucide-react';
import NoteEditor from './NoteEditor';
import { CommunityVault } from './lib/vault';
import { parsePlaintextFiles } from './lib/transfer';
import { searchNotes } from './lib/search';

const vault = new CommunityVault();
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.';

function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Dialog({ title, children, close }: { title: string; children: ReactNode; close?: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = container.current;
    const focusables = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea,a[href]') ?? [])];
    focusables()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = focusables(); const first = items[0]; const last = items.at(-1);
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="sc-modal-overlay"><div ref={container} className="sc-modal community-dialog" role="dialog" aria-modal="true" aria-label={title}>
    <div className="dialog-heading"><h2>{title}</h2>{close && <button className="sc-icon-btn" aria-label="Close dialog" onClick={close}><X /></button>}</div>
    {children}
  </div></div>;
}

export default function App() {
  const state = useSyncExternalStore(vault.subscribe, vault.getSnapshot);
  const [fatal, setFatal] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [trash, setTrash] = useState(false);
  const [settings, setSettings] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [outline, setOutline] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [rename, setRename] = useState<{ from: string; to: string } | null>(null);
  const [destroy, setDestroy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('community-theme') ?? 'dark');
  const [align, setAlign] = useState(() => localStorage.getItem('community-align') ?? 'left');
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { void vault.init().catch(error => setFatal(message(error))); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('community-theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.dataset.noteAlign = align; localStorage.setItem('community-align', align); }, [align]);
  useEffect(() => {
    if (state.status !== 'unlocked') { setActiveId(null); setQuery(''); setSettings(false); setCollapsed({}); setRename(null); setDestroy(false); setNotice(''); }
  }, [state.status]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (state.saving || state.error) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [state.saving, state.error]);
  async function run(operation: () => Promise<unknown>) {
    setBusy(true); setNotice('');
    try { await operation(); } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
  }
  const active = state.notes.find(note => note.id === activeId && note.deleted === trash);
  const found = !trash && query.trim() ? new Set(searchNotes(query)) : null;
  const notes = state.notes.filter(note => note.deleted === trash && (!found || found.has(note.id)) && (!trash || note.title.toLowerCase().includes(query.toLowerCase())));
  const folders = [...new Set(notes.map(note => note.folder))].sort((a,b) => a.localeCompare(b));
  const headings = active?.content.split('\n').flatMap(line => { const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line); return match ? [{ level: match[1].length, text: match[2] }] : []; }) ?? [];
  function jump(text: string) {
    const normalize = (value: string) => value.replace(/[*_`~]/g, '').trim();
    const target = [...document.querySelectorAll<HTMLElement>('.milkdown h1,.milkdown h2,.milkdown h3,.milkdown h4,.milkdown h5,.milkdown h6')].find(el => normalize(el.textContent ?? '') === normalize(text));
    target?.scrollIntoView({ block: 'start' });
    if (matchMedia('(max-width: 700px)').matches) setSidebar(false);
  }
  function choose(id: string) { setActiveId(id); if (matchMedia('(max-width: 700px)').matches) setSidebar(false); }
  async function create() { setTrash(false); setQuery(''); choose(await vault.createNote()); }
  if (fatal) return <main className="gate"><h1>Could not open local storage</h1><p role="alert">{fatal}</p><button className="sc-btn" onClick={() => location.reload()}>Reload</button></main>;
  if (!state.ready) return <main className="gate"><p role="status">Opening local vault…</p></main>;

  return <>
    {state.status === 'create' || state.status === 'locked' ? <VaultGate hasVault={state.status === 'locked'} /> : state.status === 'reset-password' ? <ResetPassword /> :
      <div className={`workspace ${sidebar ? '' : 'sidebar-closed'}`}>
        <aside className="sidebar" aria-label="Notes sidebar">
          <div className="sidebar-top"><Brand /><button className="sc-icon-btn" aria-label="Hide sidebar" onClick={() => setSidebar(false)}><PanelLeftClose /></button></div>
          <button className="sc-btn sc-btn-primary new-note" disabled={busy} onClick={() => void run(create)}><Plus />New note</button>
          <label className="search"><Search /><input className="sc-input" aria-label="Search notes" placeholder="Search notes" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <div className="list-heading"><span>{trash ? 'Trash' : 'Notes'}</span><span>{notes.length}</span></div>
          <nav className="note-list" aria-label={trash ? 'Deleted notes' : 'Your notes'}>
            {folders.map(folder => <section key={folder} className="folder-group">{folder && <div className="folder-heading"><button className="folder-toggle" aria-expanded={!collapsed[folder]} onClick={() => setCollapsed({ ...collapsed, [folder]: !collapsed[folder] })}>{collapsed[folder] ? <ChevronRight /> : <ChevronDown />}<span>{folder}</span></button>{!trash && <><button className="sc-icon-btn" aria-label={`Rename folder ${folder}`} onClick={() => setRename({ from: folder, to: folder })}><Pencil /></button><button className="sc-icon-btn" aria-label={`Move folder ${folder} to trash`} disabled={busy} onClick={() => void run(async () => { await vault.updateFolder(folder, { trash: true }); setActiveId(null); })}><Trash2 /></button></>}</div>}
            {!collapsed[folder] && notes.filter(note => note.folder === folder).map(note => <button key={note.id} className={`note-row ${activeId === note.id ? 'selected' : ''}`} onClick={() => choose(note.id)}>
              <FileText /><span><strong>{note.title || 'Untitled'}</strong><small>{note.folder || new Date(note.updatedAt).toLocaleDateString()}</small></span>
            </button>)}</section>)}
            {!notes.length && <p className="empty-list">{query ? 'No matching notes.' : trash ? 'Trash is empty.' : 'No notes yet.'}</p>}
          </nav>
          {outline && active && <nav className="outline" aria-label="Note outline">{headings.length ? headings.map((heading,index) => <button key={index} style={{ paddingLeft: `${.35 + (heading.level - 1) * .5}rem` }} onClick={() => jump(heading.text)}>{heading.text}</button>) : <p className="empty-list">No headings in this note.</p>}</nav>}
          <div className="sidebar-bottom">
            <button className="sc-btn sc-btn-ghost" aria-pressed={outline} onClick={() => setOutline(!outline)}><List />Outline</button>
            <button className="sc-btn sc-btn-ghost" onClick={() => { setTrash(!trash); setActiveId(null); setQuery(''); }}><Trash2 />{trash ? 'Back to notes' : 'Trash'}</button>
            <button className="sc-btn sc-btn-ghost" onClick={() => setSettings(true)}><Settings2 />Settings</button>
            <div className="sidebar-tools"><button className="sc-btn" disabled={busy} onClick={() => void run(() => vault.lock())}><LockKeyhole />Lock</button>
              <button className="sc-icon-btn" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</button></div>
            <p className="local-label">Local vault · 0.1</p>
            <a className="product-site" href="https://scrinium-note.com/" target="_blank" rel="noreferrer">Scrinium website</a>
          </div>
        </aside>
        <main className="editor-pane">
          <header className="editor-toolbar"><div>{!sidebar && <button className="sc-icon-btn" aria-label="Show sidebar" onClick={() => setSidebar(true)}><PanelLeftOpen /></button>}<span>{trash ? 'Trash' : 'Local notes'}</span></div>
            <div><span className="save-state" role="status">{state.saving ? 'Saving…' : state.error ? 'Not saved' : 'Saved locally'}</span>{active && (trash ?
              <button className="sc-btn" disabled={busy} onClick={() => void run(async () => { await vault.updateNote(active.id, { deleted: false }); setActiveId(null); })}><RotateCcw />Restore note</button> :
              <button className="sc-icon-btn" aria-label="Move note to trash" disabled={busy} onClick={() => void run(async () => { await vault.updateNote(active.id, { deleted: true }); setActiveId(null); })}><Trash2 /></button>)}</div>
          </header>
          {(notice || state.error) && <div className="error-banner" role="alert">{notice || state.error}{state.error && <button className="sc-btn" onClick={() => void run(() => vault.retrySaving())}>Retry save</button>}</div>}
          {active ? <section className="document" aria-label="Note editor"><input className="note-title" aria-label="Note title" value={active.title} readOnly={trash} onChange={event => void vault.updateNote(active.id, { title: event.target.value }).catch(() => {})} />
            <label className="folder-field">Folder<input aria-label="Note folder" className="sc-input" value={active.folder} readOnly={trash} onChange={event => void vault.updateNote(active.id, { folder: event.target.value }).catch(() => {})} /></label>
            {trash ? <pre className="trashed-content">{active.content}</pre> : <NoteEditor key={active.id} value={active.content} onChange={content => void vault.updateNote(active.id, { content }).catch(() => {})} />}
          </section> : <div className="editor-empty"><h1>{trash ? 'Deleted notes' : 'Your local notes'}</h1><p>{trash ? 'Select a note to restore it.' : 'Create a note to start writing.'}</p>{!trash && <button className="sc-btn sc-btn-primary" disabled={busy} onClick={() => void run(create)}><Plus />New note</button>}</div>}
        </main>
      </div>}
    {state.recoveryKey && <RecoveryKey value={state.recoveryKey} />}
    {settings && <Dialog title="Settings" close={() => { setSettings(false); setNotice(''); }}>
      <h3>Data</h3><p className="muted">Notes are stored in this browser. Keep an encrypted backup before clearing browser data or changing the website address.</p>
      <div className="settings-actions"><button className="sc-btn" disabled={busy} onClick={() => void run(async () => download(await vault.exportEncrypted(), 'scrinium-note-encrypted.json'))}>Export encrypted backup</button>
        <button className="sc-btn" disabled={busy} onClick={() => void run(async () => download(await vault.exportPlaintext(), 'scrinium-note-plaintext.json'))}>Export plain JSON</button>
        <button className="sc-btn" disabled={busy} onClick={() => fileInput.current?.click()}>Import Markdown, text or JSON</button>
        <input ref={fileInput} type="file" hidden multiple accept=".md,.markdown,.txt,.json" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void run(async () => { const count = await vault.importPlaintext(await parsePlaintextFiles(files)); setNotice(`Imported ${count} note${count === 1 ? '' : 's'}.`); }); }} /></div>
      <PasswordChange busy={busy} run={run} />
      <h3>Appearance</h3><div className="alignment" role="group" aria-label="Note text alignment">{['left','center','wide'].map(value => <button key={value} className="sc-btn" aria-pressed={align === value} onClick={() => setAlign(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div>
      <h3>Recovery</h3><button className="sc-btn" disabled={busy} onClick={() => void run(async () => { await vault.regenerateRecovery(); setSettings(false); })}>Regenerate recovery key</button>
      <h3>Delete local vault</h3><button className="sc-btn sc-btn-danger" disabled={busy} onClick={() => { setSettings(false); setDestroy(true); }}>Delete local vault…</button>
      {notice && <p className="notice" role="status">{notice}</p>}
    </Dialog>}
    {rename && <Dialog title="Rename folder" close={() => setRename(null)}><form onSubmit={event => { event.preventDefault(); void run(async () => { await vault.updateFolder(rename.from, { name: rename.to }); setRename(null); }); }}><label>Folder name<input className="sc-input" aria-label="Folder name" value={rename.to} onChange={event => setRename({ ...rename, to: event.target.value })} required /></label><button className="sc-btn sc-btn-primary" disabled={busy}>Save folder</button>{notice && <p role="alert">{notice}</p>}</form></Dialog>}
    {destroy && <DeleteVault close={() => setDestroy(false)} />}
  </>;
}

function DeleteVault({ close }: { close: () => void }) {
  const [password,setPassword] = useState(''); const [confirmation,setConfirmation] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  return <Dialog title="Delete local vault" close={close}><p>This permanently deletes all notes and keys from this local vault in this browser. Export an encrypted backup in Settings first if you want to keep them.</p><form onSubmit={event => { event.preventDefault(); setBusy(true); setError(''); void vault.destroy(password, confirmation).then(close).catch(failure => setError(message(failure))).finally(() => setBusy(false)); }}>
    <label>Vault password<input className="sc-input" aria-label="Vault password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
    <label>Type DELETE to confirm<input className="sc-input" aria-label="Type DELETE to confirm" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" required /></label>
    {error && <p role="alert">{error}</p>}<button className="sc-btn sc-btn-danger" disabled={busy || confirmation !== 'DELETE'}>Delete vault permanently</button>
  </form></Dialog>;
}

function Brand() { return <div className="brand"><img src="/icon.png" alt="" width="30" height="30" /><span>Scrinium Note</span></div>; }

function VaultGate({ hasVault }: { hasVault: boolean }) {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [recovery, setRecovery] = useState(false); const [restore, setRestore] = useState(false);
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (restore) {
        if (!file) throw new Error('Choose an encrypted Scrinium Note backup.');
        if (file.size > 50 * 1024 * 1024) throw new Error('This backup exceeds the 50 MB import limit.');
        await vault.restoreEmpty(JSON.parse(await file.text()), password, recovery);
      } else if (hasVault) await vault.unlock(password, recovery);
      else { if (password !== confirm) throw new Error('Passwords do not match.'); await vault.create(password); }
      setPassword(''); setConfirm('');
    } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  return <main className="gate"><Brand /><section className="sc-card gate-card"><h1>{restore ? 'Restore a backup' : hasVault ? 'Unlock your vault' : 'Create a local vault'}</h1>
    <p className="muted">Encrypted notes stored in this browser.</p>
    <form onSubmit={event => void submit(event)}>
      {restore && <label>Encrypted backup<input type="file" accept=".json" aria-label="Encrypted backup" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>}
      <label>{recovery ? 'Recovery key' : 'Vault password'}<input className="sc-input" aria-label={recovery ? 'Recovery key' : 'Vault password'} type={recovery ? 'text' : 'password'} autoComplete={recovery ? 'off' : hasVault || restore ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} required /></label>
      {!hasVault && !restore && <label>Confirm password<input className="sc-input" aria-label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required /></label>}
      {error && <p className="notice" role="alert">{error}</p>}
      <button className="sc-btn sc-btn-primary" type="submit" disabled={busy}>{busy ? 'Working…' : restore ? 'Restore backup' : hasVault ? 'Unlock vault' : 'Create vault'}</button>
    </form>
    {(hasVault || restore) && <button className="text-button" disabled={busy} onClick={() => { setRecovery(!recovery); setPassword(''); setError(''); }}>{recovery ? 'Use your password' : 'Use a recovery key'}</button>}
    {!hasVault && <button className="text-button" disabled={busy} onClick={() => { setRestore(!restore); setRecovery(false); setPassword(''); setConfirm(''); setError(''); }}>{restore ? 'Create a new vault instead' : 'Restore an encrypted backup'}</button>}
  </section><a className="product-site" href="https://scrinium-note.com/" target="_blank" rel="noreferrer">Scrinium website</a></main>;
}

function RecoveryKey({ value }: { value: string }) {
  const [saved, setSaved] = useState(false); const [error, setError] = useState('');
  return <Dialog title="Save your recovery key"><p>Keep this key somewhere safe. It can unlock your vault if you forget the password.</p>
    <textarea className="sc-input recovery-key" readOnly aria-label="Your recovery key" value={value} />
    <button className="sc-btn" onClick={() => void navigator.clipboard.writeText(value).catch(() => setError('Select the key and copy it manually.'))}>Copy key</button>
    {error && <p role="alert">{error}</p>}
    <label className="checkbox-label"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />I saved my recovery key</label>
    <button className="sc-btn sc-btn-primary" disabled={!saved} onClick={() => vault.dismissRecovery()}>Continue</button>
  </Dialog>;
}

function ResetPassword() {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { if (password !== confirm) throw new Error('Passwords do not match.'); await vault.setPassword(password); setPassword(''); setConfirm(''); } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  return <main className="gate"><Brand /><section className="sc-card gate-card"><h1>Set a new password</h1><form onSubmit={event => void submit(event)}>
    <label>New password<input className="sc-input" type="password" autoComplete="new-password" aria-label="New password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
    <label>Confirm password<input className="sc-input" type="password" autoComplete="new-password" aria-label="Confirm new password" value={confirm} onChange={event => setConfirm(event.target.value)} required /></label>
    {error && <p role="alert">{error}</p>}<button className="sc-btn sc-btn-primary" disabled={busy}>Set password</button>
  </form></section></main>;
}

function PasswordChange({ busy, run }: { busy: boolean; run: (operation: () => Promise<unknown>) => Promise<void> }) {
  const [old, setOld] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  return <form className="password-change" onSubmit={event => { event.preventDefault(); void run(async () => {
    if (password !== confirm) throw new Error('Passwords do not match.'); await vault.setPassword(password, old); setOld(''); setPassword(''); setConfirm('');
  }); }}><h3>Change password</h3>
    <label>Current password<input className="sc-input" type="password" aria-label="Current password" autoComplete="current-password" value={old} onChange={event => setOld(event.target.value)} required /></label>
    <label>New password<input className="sc-input" type="password" aria-label="New password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
    <label>Confirm new password<input className="sc-input" type="password" aria-label="Confirm new password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required /></label>
    <button className="sc-btn" disabled={busy}>Change password</button>
  </form>;
}
