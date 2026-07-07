// src/components/RichTextEditor.tsx
// TypeScript wrapper for the TipTap-based RichTextEditor.
// The original RichTextEditor.jsx from ComfyStack is placed at
// src/components/RichTextEditor.jsx alongside this file.
// This wrapper simply re-exports it with proper TypeScript types.

import React from 'react';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — the JSX file has no types; we declare them here
import RichTextEditorRaw from './RichTextEditor.jsx';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = (props) => {
  return <RichTextEditorRaw {...props} />;
};

export default RichTextEditor;
