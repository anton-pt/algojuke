# Research: Make Chat Mode Default and Mobile-Friendly

**Date**: 2026-01-08
**Feature**: ALG-29
**Implementation Guidance**: None specified

## Executive Summary

This feature requires three main changes:

1. **Default route change** - Simple Navigate component update in DiscoverPage.tsx
2. **Mobile drawer** - New MobileDrawer component reusing existing conversation list rendering from ChatSidebar
3. **Collapsible sidebar** - Add collapse state and animations to existing ChatSidebar

Key architectural decision: The mobile drawer will be a separate component that reuses ChatSidebar's internal `ConversationItem` component, keeping the drawer and sidebar implementations cleanly separated while sharing rendering logic.

## Key Decisions

### 1. Drawer vs Sidebar Architecture

**Decision**: Create a separate `MobileDrawer` component that internally renders `ChatSidebar` content

**Rationale**:

- Mobile drawer has different layout requirements (overlay, slide animation, close on selection)
- Desktop sidebar has different requirements (collapse animation, persistent visibility)
- Sharing the same component with conditional rendering would create complex logic
- The `ConversationItem` rendering can be extracted/reused between both

**Alternatives Considered**:

- **Single ChatSidebar with responsive modes**: Rejected - would require complex conditional rendering for overlay, animations, and close behavior
- **Render ChatSidebar inside drawer portal**: Rejected - CSS complexity with nested responsive breakpoints

### 2. State Management Location

**Decision**: Manage all state in `ChatPage.tsx`:

- `isDrawerOpen: boolean` - mobile drawer visibility
- `isSidebarCollapsed: boolean` - desktop sidebar collapse state (loaded from localStorage)

**Rationale**:

- ChatPage already manages `selectedConversationId` and `isStreaming`
- Single source of truth for layout state
- Callbacks can be passed down to both ChatSidebar and MobileDrawer
- Avoids need for new context

**Alternatives Considered**:

- **New SidebarContext**: Rejected - overkill for two boolean states that only affect this page
- **State in ChatSidebar itself**: Rejected - ChatPage needs to control hamburger button visibility

### 3. Animation Strategy

**Decision**: Use CSS transitions for all animations

| Animation        | CSS Property              | Duration       |
| ---------------- | ------------------------- | -------------- |
| Sidebar collapse | `width`                   | 0.2s ease      |
| Drawer slide     | `transform: translateX()` | 0.3s ease-out  |
| Overlay fade     | `opacity`                 | 0.15s ease-out |

**Rationale**:

- Consistent with existing patterns (LeaveConfirmDialog uses 0.15-0.2s transitions)
- CSS transitions are GPU-accelerated when using transform/opacity
- No external animation library needed

**Alternatives Considered**:

- **CSS @keyframes animations**: Rejected - transitions are simpler for two-state changes
- **Framer Motion**: Rejected - adding a library for simple animations is overkill

### 4. localStorage Key Naming

**Decision**: Use `algojuke-sidebar-collapsed` for the localStorage key

**Rationale**:

- Follows existing pattern from `RETURN_URL_KEY = "algojuke-return-url"`
- Prefix with app name to avoid conflicts
- Descriptive name makes debugging easier

**Pattern**:

```typescript
const SIDEBAR_COLLAPSED_KEY = "algojuke-sidebar-collapsed";

// Read on mount
const [isCollapsed, setIsCollapsed] = useState(() => {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
});

// Persist on change
const handleToggleCollapse = useCallback(() => {
  setIsCollapsed((prev) => {
    const next = !prev;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    return next;
  });
}, []);
```

### 5. Responsive Breakpoint Detection

**Decision**: Use CSS media queries for hiding/showing, plus `matchMedia` listener for state synchronization

**Rationale**:

- CSS handles the visual hiding (sidebar `display: none` at <768px)
- JavaScript `matchMedia` listener closes drawer when resizing to desktop
- Consistent with existing 768px breakpoint used throughout the app

**Pattern**:

```typescript
useEffect(() => {
  const mediaQuery = window.matchMedia("(min-width: 769px)");

  const handleChange = (e: MediaQueryListEvent) => {
    if (e.matches) {
      // Crossed to desktop - close drawer
      setIsDrawerOpen(false);
    }
  };

  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}, []);
```

## Implementation Patterns

### Pattern 1: Default Route (DiscoverPage.tsx)

Current:

```tsx
<Route path="/" element={<Navigate to="search" replace />} />
```

Change to:

```tsx
<Route path="/" element={<Navigate to="chat" replace />} />
```

### Pattern 2: Overlay and Slide Animation (from LeaveConfirmDialog.css)

```css
/* Overlay fade in */
.mobile-drawer__overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  animation: fadeIn 0.15s ease-out;
}

/* Drawer slide from left */
.mobile-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  background-color: var(--bg-secondary, #f9fafb);
  z-index: 1001;
  transform: translateX(-100%);
  transition: transform 0.3s ease-out;
}

.mobile-drawer--open {
  transform: translateX(0);
}
```

### Pattern 3: Sidebar Collapse Animation

```css
.chat-sidebar {
  width: 280px;
  transition: width 0.2s ease;
}

.chat-sidebar--collapsed {
  width: 60px;
}

/* Hide text content when collapsed */
.chat-sidebar--collapsed .chat-sidebar__title,
.chat-sidebar--collapsed .chat-sidebar__item-content,
.chat-sidebar--collapsed .chat-sidebar__new-button-text {
  display: none;
}

/* Show only icon in collapsed state */
.chat-sidebar--collapsed .chat-sidebar__new-button {
  width: 36px;
  height: 36px;
  padding: 0;
  /* Plus icon centered */
}
```

### Pattern 4: Hamburger Button (visible only on mobile)

```css
.chat-page__hamburger {
  display: none;
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

@media (max-width: 768px) {
  .chat-page__hamburger {
    display: flex;
  }
}
```

### Pattern 5: Focus Trap (from LeaveConfirmDialog.tsx)

```typescript
useEffect(() => {
  if (!isOpen || !drawerRef.current) return;

  const drawer = drawerRef.current;
  const focusableElements = drawer.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };

  drawer.addEventListener("keydown", handleTab);
  return () => drawer.removeEventListener("keydown", handleTab);
}, [isOpen]);
```

### Pattern 6: Escape Key Handling

```typescript
useEffect(() => {
  if (!isOpen) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [isOpen, onClose]);
```

## Files to Modify

| File                                                    | Changes                                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/pages/DiscoverPage.tsx`                   | Change default route from `"search"` to `"chat"` (line 29)                                                                    |
| `frontend/src/components/chat/ChatPage.tsx`             | Add `isDrawerOpen`, `isSidebarCollapsed` state; add hamburger button; pass collapse props to ChatSidebar; render MobileDrawer |
| `frontend/src/components/chat/ChatPage.css`             | Add hamburger button styles; position for mobile                                                                              |
| `frontend/src/components/chat/ChatSidebar.tsx`          | Add `isCollapsed` and `onToggleCollapse` props; add collapse toggle button in header                                          |
| `frontend/src/components/chat/ChatSidebar.css`          | Add collapse styles, width transition, collapsed content hiding                                                               |
| **NEW** `frontend/src/components/chat/MobileDrawer.tsx` | Drawer component with overlay, slide animation, focus trap, conversation list                                                 |
| **NEW** `frontend/src/components/chat/MobileDrawer.css` | Overlay styles, slide animation, drawer layout                                                                                |

## Component Interface Design

### ChatSidebar Props (updated)

```typescript
interface ChatSidebarProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isStreaming?: boolean;
  // New props for collapse
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}
```

### MobileDrawer Props (new)

```typescript
interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isStreaming?: boolean;
}
```

### ChatPage State (updated)

```typescript
// Existing
const [selectedConversationId, setSelectedConversationId] = useState<
  string | null
>(null);
const [isStreaming, setIsStreaming] = useState(false);

// New
const [isDrawerOpen, setIsDrawerOpen] = useState(false);
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
  return localStorage.getItem("algojuke-sidebar-collapsed") === "true";
});
```

## Accessibility Considerations

1. **Drawer ARIA attributes**:
   - `role="dialog"` on drawer
   - `aria-modal="true"` when open
   - `aria-label="Conversation history"`

2. **Hamburger button**:
   - `aria-label="Open conversation history"`
   - `aria-expanded={isDrawerOpen}`
   - `aria-controls="mobile-drawer"`

3. **Collapse toggle**:
   - `aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}`
   - `aria-expanded={!isCollapsed}`

4. **Focus management**:
   - Focus first focusable element when drawer opens
   - Return focus to hamburger button when drawer closes
   - Trap focus within drawer while open

5. **Reduced motion**:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .mobile-drawer,
     .chat-sidebar {
       transition: none;
     }
   }
   ```
