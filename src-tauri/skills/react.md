---
name: React
detect:
  files: ["package.json"]
  content_patterns: ["react", "react-dom"]
  extensions: [".jsx", ".tsx"]
tags: [frontend, javascript, react]
description: React-specific concerns including state management, useEffect pitfalls, and re-render performance
---

## React-Specific Concerns

### State Management
- Is state lifted to the correct level (not too high, not too low)?
- Are expensive computations memoized with useMemo?
- Is context used appropriately (not for high-frequency updates)?
- Are state updates batched where possible?

### useEffect Pitfalls
- Does useEffect have correct dependencies (no missing, no unnecessary)?
- Is there a cleanup function for subscriptions, timers, and event listeners?
- Are async operations in useEffect properly handled (race conditions, stale closures)?
- Is useEffect used for synchronization (correct) vs. event handling (incorrect)?

### Performance
- Are list items using stable, unique keys (not array index)?
- Are components that receive objects/arrays as props memoized with React.memo?
- Are callback props wrapped in useCallback to prevent child re-renders?
- Are large lists virtualized (react-window, react-virtualized)?

### Security
- Is dangerouslySetInnerHTML avoided or properly sanitized?
- Are user inputs escaped before rendering?
- Are URLs validated before use in href/src attributes?

### Common React Anti-Patterns
- Mutating state directly instead of creating new references
- Using state for values derivable from other state (use useMemo instead)
- Prop drilling through many layers (consider context or composition)
- Fetching data in components without loading/error states
- Not handling component unmount during async operations
