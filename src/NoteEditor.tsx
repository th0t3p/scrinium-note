import { useEffect, useRef, useState } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { nord } from '@milkdown/theme-nord';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { trailing } from '@milkdown/kit/plugin/trailing';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { prism } from '@milkdown/plugin-prism';

/** Basic editor extracted from Scrinium; no account, attachment or Pro imports. */
export default function NoteEditor({ value, onChange }: { value: string; onChange: (markdown: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange);
  const initial = useRef(value);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  callback.current = onChange;
  initial.current = value;
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    let editor: Editor | null = null;
    setError('');
    const created = Editor.make().config(nord).config(ctx => {
      ctx.set(rootCtx, host.current);
      ctx.set(defaultValueCtx, initial.current);
      ctx.set(editorViewOptionsCtx, { attributes: { 'aria-label': 'Note content', role: 'textbox', 'aria-multiline': 'true' } });
      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, previous) => {
        if (!disposed && markdown !== previous) callback.current(markdown);
      });
    }).use(commonmark).use(gfm).use(history).use(listener).use(trailing).use(clipboard).use(prism).create();
    void created.then(instance => { if (disposed) void instance.destroy(); else editor = instance; })
      .catch(failure => { if (!disposed) setError(failure instanceof Error ? failure.message : 'Could not open the editor.'); });
    return () => { disposed = true; if (editor) void editor.destroy(); };
  }, [attempt]);
  return <><div ref={host} />{error && <div role="alert"><p>{error}</p><button className="sc-btn" onClick={() => setAttempt(attempt + 1)}>Retry editor</button></div>}</>;
}
