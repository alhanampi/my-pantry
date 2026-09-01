import styled from 'styled-components'

// A plain flex child, not sticky/fixed — it's pinned to the bottom of the
// screen because it's the last child of ChatView's fixed-height ChatBody
// (see ChatView.styles.ts's useAvailableHeight comment). `position: sticky`
// alone doesn't work here: it only pins once content overflows its
// scrolling ancestor, which isn't true for a short/empty conversation.
export const ComposerRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--scheme-border);
  background: var(--scheme-bg);
  flex-shrink: 0;
`
