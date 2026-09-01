import { useEffect, useState, type RefObject } from 'react'

/**
 * Measures the space available below `ref`'s top edge down to the bottom of
 * the visible viewport, minus `reserveBottom` (e.g. a fixed bottom nav that
 * overlays the page rather than taking up document flow height). Used by
 * ChatView to give the message list a real bounded height so the composer
 * sits pinned at the bottom of the screen even when there are few/no
 * messages yet — `position: sticky` alone only pins once content overflows,
 * which doesn't hold for a short/empty conversation.
 *
 * Recomputed on window resize and on the mobile visualViewport resizing
 * (address bar show/hide, on-screen keyboard).
 */
export function useAvailableHeight(ref: RefObject<HTMLElement | null>, reserveBottom: number): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    function update(): void {
      const node = ref.current
      if (!node) return
      const top = node.getBoundingClientRect().top
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      setHeight(Math.max(240, viewportHeight - top - reserveBottom))
    }

    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)

    // Also re-measure on any layout shift above/around this element (e.g. a
    // web font swapping in after first paint changes the header's height,
    // without firing a window resize event) — a plain window resize
    // listener alone can leave a stale `top` and reintroduce page-level
    // overflow/scroll. Guarded: not implemented in jsdom (tests) and not
    // universally available in every browser.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(document.body)

    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [ref, reserveBottom])

  return height
}
