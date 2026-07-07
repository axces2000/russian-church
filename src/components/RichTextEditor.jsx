// src/components/RichTextEditor.jsx
// TipTap rich text editor loaded from esm.sh CDN.
// Toolbar + URL input panels both go fixed when scrolled below admin header.

import React, { useEffect, useRef, useState } from 'react';

const COLOURS = [
  { label: 'Default', value: null },
  { label: 'Cyan',    value: '#38bdf8' },
  { label: 'White',   value: '#dce8f8' },
  { label: 'Muted',   value: '#6a8aaa' },
  { label: 'Green',   value: '#10b981' },
  { label: 'Amber',   value: '#f59e0b' },
  { label: 'Red',     value: '#ef4444' },
];

function TBtn({ active, onClick, title, children, disabled }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title} disabled={disabled}
      style={{
        padding: '4px 8px', border: 'none', borderRadius: 4,
        background: active ? 'var(--sand-amber)' : 'var(--sand-border)',
        color: active ? '#0e1525' : 'var(--sand-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12, fontWeight: active ? 700 : 400,
        fontFamily: "'JetBrains Mono', monospace",
        opacity: disabled ? 0.4 : 1, minWidth: 28,
      }}
    >{children}</button>
  );
}

const inputSty = {
  flex: 1, padding: '5px 8px', fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  background: 'var(--sand-bg)', color: 'var(--sand-text)',
  border: '0.5px solid var(--sand-border)', borderRadius: 4, outline: 'none',
};

function MiniBtn({ onClick, label, color }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      style={{
        padding: '4px 10px', border: 'none', borderRadius: 4,
        background: color || 'var(--sand-amber)', color: '#0e1525',
        cursor: 'pointer', fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >{label}</button>
  );
}

export default function RichTextEditor({ value, onChange }) {
  const editorRef    = useRef(null);
  const editorInst   = useRef(null);
  const containerRef = useRef(null); // outer data-rte-container div
  const sentinelRef  = useRef(null); // 1px div above the chrome block
  const chromeRef    = useRef(null); // toolbar + inputs together

  const [ready, setReady]           = useState(false);
  const [activeMarks, setActiveMarks] = useState({});
  const [showLink, setShowLink]     = useState(false);
  const [showYT, setShowYT]         = useState(false);
  const [showImg, setShowImg]       = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('');
  const [linkUrl, setLinkUrl]       = useState('');
  const [ytUrl, setYtUrl]           = useState('');
  const [imgUrl, setImgUrl]         = useState('');
  const [fixed, setFixed]           = useState(false);
  const [fixedWidth, setFixedWidth] = useState('auto');
  const [chromeHeight, setChromeHeight] = useState(0);

  // ── Load TipTap ────────────────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    async function init() {
      try {
        const [
          { Editor }, { Document }, { Paragraph }, { Text },
          { Bold }, { Italic }, { Heading }, { Color }, { TextStyle },
          { Link }, { Youtube }, { History }, { HardBreak }, { Image },
        ] = await Promise.all([
          import('https://esm.sh/@tiptap/core@2.4.0'),
          import('https://esm.sh/@tiptap/extension-document@2.4.0'),
          import('https://esm.sh/@tiptap/extension-paragraph@2.4.0'),
          import('https://esm.sh/@tiptap/extension-text@2.4.0'),
          import('https://esm.sh/@tiptap/extension-bold@2.4.0'),
          import('https://esm.sh/@tiptap/extension-italic@2.4.0'),
          import('https://esm.sh/@tiptap/extension-heading@2.4.0'),
          import('https://esm.sh/@tiptap/extension-color@2.4.0'),
          import('https://esm.sh/@tiptap/extension-text-style@2.4.0'),
          import('https://esm.sh/@tiptap/extension-link@2.4.0'),
          import('https://esm.sh/@tiptap/extension-youtube@2.4.0'),
          import('https://esm.sh/@tiptap/extension-history@2.4.0'),
          import('https://esm.sh/@tiptap/extension-hard-break@2.4.0'),
          import('https://esm.sh/@tiptap/extension-image@2.4.0'),
        ]);
        if (destroyed || !editorRef.current) return;
        const editor = new Editor({
          element: editorRef.current,
          extensions: [
            Document, Paragraph, Text, Bold, Italic, History, HardBreak,
            Heading.configure({ levels: [2, 3, 4] }),
            TextStyle, Color,
            Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener' } }),
            Youtube.configure({ width: '100%', height: 300 }),
            Image.configure({ inline: false, allowBase64: false }),
          ],
          content: value || '',
          onUpdate: ({ editor }) => { onChange?.(editor.getHTML()); updateMarks(editor); },
          onSelectionUpdate: ({ editor }) => updateMarks(editor),
          editorProps: {
            attributes: {
              style: [
                'min-height:160px', 'padding:10px 12px', 'outline:none',
                "font-family:Source Serif 4,Georgia,serif",
                'font-size:13px', 'line-height:1.7', 'color:var(--sand-text)',
              ].join(';'),
            },
          },
        });
        editorInst.current = editor;
        setReady(true);
      } catch (err) { console.error('TipTap load error:', err); }
    }
    init();
    return () => { destroyed = true; editorInst.current?.destroy(); };
  }, []);

  // Sync external value
  useEffect(() => {
    const editor = editorInst.current;
    if (!editor || !ready) return;
    if (editor.getHTML() !== value) editor.commands.setContent(value || '', false);
  }, [value, ready]);

  // ── IntersectionObserver: fix chrome (toolbar + inputs) when scrolled ─────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const hidden = !entry.isIntersecting;
        setFixed(hidden);
        if (hidden && containerRef.current) {
          setFixedWidth(containerRef.current.getBoundingClientRect().width + 'px');
        }
      },
      { threshold: 0, rootMargin: '-90px 0px 0px 0px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  // Track chrome height so the spacer matches exactly
  useEffect(() => {
    const chrome = chromeRef.current;
    if (!chrome) return;
    const ro = new ResizeObserver(() => setChromeHeight(chrome.offsetHeight));
    ro.observe(chrome);
    return () => ro.disconnect();
  }, []);

  function updateMarks(editor) {
    setActiveMarks({
      bold:   editor.isActive('bold'),
      italic: editor.isActive('italic'),
      h2:     editor.isActive('heading', { level: 2 }),
      h3:     editor.isActive('heading', { level: 3 }),
      h4:     editor.isActive('heading', { level: 4 }),
      link:   editor.isActive('link'),
    });
  }

  const e = () => editorInst.current;

  function applyLink() {
    if (!linkUrl.trim()) e()?.chain().focus().unsetLink().run();
    else e()?.chain().focus().setLink({ href: linkUrl.trim() }).run();
    setShowLink(false); setLinkUrl('');
  }
  function insertYT() {
    if (!ytUrl.trim()) return;
    e()?.chain().focus().setYoutubeVideo({ src: ytUrl.trim() }).run();
    setShowYT(false); setYtUrl('');
  }
  function insertImg() {
    if (!imgUrl.trim()) return;
    e()?.chain().focus().setImage({ src: imgUrl.trim() }).run();
    setShowImg(false); setImgUrl('');
  }
  function applyColour(val) {
    if (!val) e()?.chain().focus().unsetColor().run();
    else e()?.chain().focus().setColor(val).run();
  }

  // The "chrome" block = toolbar + any open input panel
  const chromeContent = (
    <div ref={chromeRef} style={{
      background: 'var(--sand-surface)',
      borderBottom: '0.5px solid var(--sand-border)',
      // When fixed: add borders on other sides too
      ...(fixed ? {
        position: 'fixed', top: 90, zIndex: 200,
        width: fixedWidth,
        border: '0.5px solid var(--sand-border)',
        boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
      } : {}),
    }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 10px' }}>
        <TBtn active={activeMarks.bold}   onClick={() => e()?.chain().focus().toggleBold().run()}              title="Bold"      disabled={!ready}><b>B</b></TBtn>
        <TBtn active={activeMarks.italic} onClick={() => e()?.chain().focus().toggleItalic().run()}            title="Italic"    disabled={!ready}><i>I</i></TBtn>
        <TBtn active={activeMarks.h2}     onClick={() => e()?.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"      disabled={!ready}>H2</TBtn>
        <TBtn active={activeMarks.h3}     onClick={() => e()?.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"      disabled={!ready}>H3</TBtn>
        <TBtn active={activeMarks.h4}     onClick={() => e()?.chain().focus().toggleHeading({ level: 4 }).run()} title="H4"      disabled={!ready}>H4</TBtn>

        <div style={{ width: 1, background: 'var(--sand-border)', margin: '0 2px' }} />

        {/* Colour swatches */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {COLOURS.map(c => (
            <button key={c.label} title={c.label}
              onMouseDown={ev => { ev.preventDefault(); applyColour(c.value); }}
              style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--sand-border)', background: c.value || 'var(--sand-text)', cursor: 'pointer', padding: 0 }}
            />
          ))}
        </div>

        <div style={{ width: 1, background: 'var(--sand-border)', margin: '0 2px' }} />

        <TBtn active={activeMarks.link} onClick={() => { setShowLink(v => !v); setShowYT(false); setShowImg(false); }} title="Link"           disabled={!ready}>🔗</TBtn>
        <TBtn active={false}            onClick={() => { setShowYT(v => !v);   setShowLink(false); setShowImg(false); }} title="YouTube"        disabled={!ready}>▶</TBtn>
        <TBtn active={false}            onClick={() => { setShowImg(v => !v);  setShowLink(false); setShowYT(false); }}  title="Image by URL"   disabled={!ready}>🖼</TBtn>

        <div style={{ flex: 1 }} />
        <TBtn active={false} onClick={() => e()?.chain().focus().undo().run()} title="Undo" disabled={!ready}>↩</TBtn>
        <TBtn active={false} onClick={() => e()?.chain().focus().redo().run()} title="Redo" disabled={!ready}>↪</TBtn>
        <div style={{ width: 1, background: 'var(--sand-border)', margin: '0 2px' }} />
        <TBtn active={showSource} onClick={() => {
          if (!showSource) {
            setSourceHtml(e()?.getHTML() || '');
          } else {
            e()?.commands.setContent(sourceHtml, false);
            onChange?.(sourceHtml);
          }
          setShowSource(v => !v);
          setShowLink(false); setShowYT(false); setShowImg(false);
        }} title="Edit raw HTML source" disabled={!ready}>{'</>'}</TBtn>
      </div>

      {/* ── Link input ── */}
      {showLink && (
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderTop: '0.5px solid var(--sand-border)', background: 'var(--sand-surface)' }}>
          <input value={linkUrl} onChange={ev => setLinkUrl(ev.target.value)} placeholder="https://…" style={inputSty}
            onKeyDown={ev => ev.key === 'Enter' && applyLink()} autoFocus />
          <MiniBtn onClick={applyLink} label="Set link" />
          <MiniBtn onClick={() => { e()?.chain().focus().unsetLink().run(); setShowLink(false); }} label="Remove" color="#ef4444" />
        </div>
      )}

      {/* ── YouTube input ── */}
      {showYT && (
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderTop: '0.5px solid var(--sand-border)', background: 'var(--sand-surface)' }}>
          <input value={ytUrl} onChange={ev => setYtUrl(ev.target.value)} placeholder="YouTube URL…" style={inputSty}
            onKeyDown={ev => ev.key === 'Enter' && insertYT()} autoFocus />
          <MiniBtn onClick={insertYT} label="Insert video" />
        </div>
      )}

      {/* ── Image URL input ── */}
      {showImg && (
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderTop: '0.5px solid var(--sand-border)', background: 'var(--sand-surface)' }}>
          <input value={imgUrl} onChange={ev => setImgUrl(ev.target.value)} placeholder="Image URL (https://…)" style={inputSty}
            onKeyDown={ev => ev.key === 'Enter' && insertImg()} autoFocus />
          <MiniBtn onClick={insertImg} label="Insert image" />
        </div>
      )}

      {/* ── HTML source panel ── */}
      {showSource && (
        <div style={{ borderTop: '0.5px solid var(--sand-border)', background: 'var(--sand-bg)', padding: '8px 10px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--sand-hint)', marginBottom: 4, letterSpacing: 0.5 }}>
            HTML SOURCE — edit then click &lt;/&gt; again to apply
          </div>
          <textarea
            value={sourceHtml}
            onChange={ev => setSourceHtml(ev.target.value)}
            rows={10}
            style={{
              width: '100%', padding: '8px', resize: 'vertical',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              background: '#060e1a', color: '#7dd3fc',
              border: '0.5px solid var(--sand-border)', borderRadius: 4,
              outline: 'none', lineHeight: 1.6,
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} data-rte-container style={{
      border: '0.5px solid var(--sand-border)',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--sand-bg)',
    }}>
      {/* Sentinel: when this scrolls off-screen, chrome goes fixed */}
      <div ref={sentinelRef} style={{ height: 1, pointerEvents: 'none' }} />

      {/* Chrome block (toolbar + inputs) */}
      {chromeContent}

      {/* Spacer that holds chrome's height when it goes fixed */}
      {fixed && <div style={{ height: chromeHeight }} />}

      {/* Editor area — hidden in source mode */}
      {!ready && !showSource && (
        <div style={{ padding: '12px', fontSize: 12, color: 'var(--sand-hint)', fontStyle: 'italic', fontFamily: 'monospace' }}>
          Loading editor…
        </div>
      )}
      <div ref={editorRef} style={{ display: ready && !showSource ? 'block' : 'none' }} />

      <style>{`
        .ProseMirror h2 { font-size:18px; font-weight:600; margin:14px 0 6px; font-family:'Playfair Display',serif; }
        .ProseMirror h3 { font-size:15px; font-weight:600; margin:12px 0 4px; font-family:'Playfair Display',serif; }
        .ProseMirror h4 { font-size:13px; font-weight:600; margin:10px 0 3px; font-family:'Playfair Display',serif; text-transform:uppercase; letter-spacing:0.5px; }
        .ProseMirror p  { margin:0 0 12px; min-height:1.4em; }
        .ProseMirror a  { color:#38bdf8; text-decoration:underline; }
        .ProseMirror img { max-width:100%; border-radius:6px; margin:8px 0; display:block; }
        .ProseMirror iframe { width:100%; aspect-ratio:16/9; height:auto; border-radius:6px; margin:8px 0; display:block; }
        .ProseMirror div[data-youtube-video] { margin:8px 0; }
        .ProseMirror div[data-youtube-video] iframe { width:100%; aspect-ratio:16/9; height:auto; border-radius:6px; display:block; }
        .ProseMirror:focus { outline:none; }
        .ProseMirror p.is-editor-empty:first-child::before { content:attr(data-placeholder); color:#3a5070; pointer-events:none; float:left; height:0; }
      `}</style>
    </div>
  );
}
