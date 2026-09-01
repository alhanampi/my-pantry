import styled from 'styled-components'

// No overflow/scroll of its own — it's rendered inside ChatView's
// ScrollArea (ChatView.styles.ts), which owns the actual scrolling.
export const MessagesWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 4px;
`

export const Bubble = styled.div<{ $role: 'user' | 'assistant' }>`
  max-width: 80%;
  align-self: ${(p) => (p.$role === 'user' ? 'flex-end' : 'flex-start')};
  background: ${(p) => (p.$role === 'user' ? 'var(--scheme-primary)' : 'var(--scheme-surface-alt)')};
  color: ${(p) => (p.$role === 'user' ? 'var(--scheme-on-primary, #fff)' : 'var(--scheme-text-primary)')};
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 0.85rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;

  p {
    margin: 0 0 8px;
  }
  p:last-child {
    margin-bottom: 0;
  }
  ul,
  ol {
    margin: 4px 0;
    padding-left: 20px;
  }
  li {
    margin-bottom: 4px;
  }
  li:last-child {
    margin-bottom: 0;
  }
  /* remark-gfm's "loose list" output wraps each item's text in its own <p>,
     which — combined with the p { margin: 0 0 8px } rule above — pushed the
     marker and its text apart into separate visual blocks (reported as
     numbered questions looking like a "wall of text"). Collapsing that
     nested <p> back to an inline flow keeps marker + text on one line. */
  li > p {
    display: inline;
    margin: 0;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: inherit;
    font-weight: 600;
    margin: 4px 0;
  }
  code {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    padding: 1px 4px;
  }
`
