# Product Requirements Document: Gemini Vox Enhancements

**Version:** 1.0
**Date:** December 23, 2025
**Status:** Ready for Implementation

---

## Overview

This PRD covers 5 enhancement features for Gemini Vox, a Text-to-Speech application powered by Gemini 2.5 Flash. These features improve usability, accessibility, and user feedback.

---

## Feature 1: Dark/Light Mode Toggle

### Description
Add a theme switcher allowing users to toggle between dark mode (current) and a new light mode theme.

### Requirements

#### 1.1 UI Component
- Add a toggle button in the header area (near the Export/Import buttons)
- Use `Sun` and `Moon` icons from lucide-react
- Persist preference to `localStorage` key: `gemini-vox-theme`
- On load, check `localStorage` first, then fall back to system preference via `prefers-color-scheme`

#### 1.2 Theme Implementation
- Create a theme context or use a simple state + CSS variables approach
- Add a `data-theme="light"` or `data-theme="dark"` attribute to `<html>` or root `<div>`

#### 1.3 Light Mode Color Palette
| Element | Dark Mode (Current) | Light Mode |
|---------|---------------------|------------|
| Background | `slate-950` | `slate-50` |
| Cards/Panels | `slate-900` | `white` |
| Borders | `slate-800` | `slate-200` |
| Primary Text | `slate-200` | `slate-800` |
| Secondary Text | `slate-400` | `slate-500` |
| Accent (keep same) | `indigo-500` | `indigo-500` |

#### 1.4 Components to Update
- `App.tsx` - main container, all cards
- `HistoryItem.tsx` - item backgrounds, text
- `PlayerControls.tsx` - control bar, sliders
- `Visualizer.tsx` - background behind bars

#### 1.5 Acceptance Criteria
- [ ] Toggle persists across page refreshes
- [ ] Respects system preference on first visit
- [ ] All text remains readable in both modes
- [ ] Visualizer bars visible in both modes
- [ ] Smooth transition between themes (use `transition-colors` on root)

---

## Feature 2: Voice Preview

### Description
Allow users to hear a short audio sample of each voice before selecting it, triggered on hover or click.

### Requirements

#### 2.1 Preview Audio Generation
- **Option A (Recommended):** Pre-generate static preview clips for each voice and store as base64 in a new `constants` file or load from `/public` folder
- **Option B:** Generate on-demand via API (slower, uses quota)

Recommended preview text: "Hello, this is a preview of my voice."

#### 2.2 UI Behavior
- Add a small speaker/preview icon on each voice card
- On **hover** (desktop) or **tap** (mobile) of the preview icon:
  - Show a subtle loading state if generating
  - Play the preview audio (max 2-3 seconds)
- If another preview starts, stop the previous one
- Do NOT interfere with main playback in history

#### 2.3 Implementation Details
- Create a separate `previewAudioContext` or reuse existing with separate source
- Store preview AudioBuffers in state/ref after first load
- Add to `constants.ts`:
```typescript
export const VOICE_PREVIEWS: Record<string, string> = {
  Puck: "base64_audio_data...",
  Charon: "base64_audio_data...",
  Kore: "base64_audio_data...",
  Fenrir: "base64_audio_data...",
  Zephyr: "base64_audio_data..."
};
```

#### 2.4 UI Additions
- Add `Volume2` or `PlayCircle` icon to voice cards
- Show tooltip: "Preview voice"
- While playing, icon changes to a speaker with waves animation

#### 2.5 Acceptance Criteria
- [ ] Each voice has a working preview
- [ ] Previews are short (2-3 seconds max)
- [ ] Only one preview plays at a time
- [ ] Preview doesn't interrupt main history playback
- [ ] Works on mobile (tap instead of hover)

---

## Feature 3: Multi-Speaker Support (3+ Speakers)

### Description
Extend conversation mode from 2 speakers to support 3-5 speakers with dynamic configuration.

### Requirements

#### 3.1 Data Model Updates
Update `types.ts`:
```typescript
export interface SpeakerConfig {
  id: string;        // unique id for keying
  name: string;
  voice: string;
  color?: string;    // optional UI color
}
```

#### 3.2 State Changes in App.tsx
Replace:
```typescript
const [speaker1, setSpeaker1] = useState<SpeakerConfig>(...);
const [speaker2, setSpeaker2] = useState<SpeakerConfig>(...);
```
With:
```typescript
const [speakers, setSpeakers] = useState<SpeakerConfig[]>([
  { id: '1', name: 'Joe', voice: 'Puck', color: '#6366f1' },
  { id: '2', name: 'Jane', voice: 'Kore', color: '#a855f7' }
]);
```

#### 3.3 UI Changes
- Change "Cast Configuration (2 Speakers)" to dynamic grid
- Add "Add Speaker" button (max 5 speakers)
- Add "Remove" button on each speaker card (min 2 speakers)
- Speaker cards should show a colored indicator matching their `color`
- Assign distinct colors from a preset palette:
```typescript
const SPEAKER_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];
```

#### 3.4 Service Layer Updates
Update `geminiService.ts` to handle dynamic speaker array:
```typescript
// Instead of hardcoded speaker1/speaker2
speakers: SpeakerConfig[]  // pass full array
```

Update the multi-speaker voice config builder to iterate over all speakers.

#### 3.5 Script Format
Support format:
```
Joe: Hello everyone!
Jane: Hi Joe!
Mike: Hey, what's up?
```
The Gemini API should handle this naturally with the multi-speaker config.

#### 3.6 Acceptance Criteria
- [ ] Can add speakers up to 5 total
- [ ] Can remove speakers down to 2 minimum
- [ ] Each speaker has unique name, voice, and color
- [ ] Generated audio correctly renders all speaker voices
- [ ] History item shows all speaker names (e.g., "Trio: Joe, Jane & Mike")
- [ ] Colors visually distinguish speakers in the UI

---

## Feature 4: Waveform View

### Description
Add an alternative visualization mode showing a waveform instead of the current frequency bar spectrum.

### Requirements

#### 4.1 Visualization Modes
- Add toggle between "Spectrum" (current) and "Waveform" views
- Persist preference to `localStorage` key: `gemini-vox-viz-mode`

#### 4.2 UI Toggle
- Add small toggle buttons or segmented control above or below the visualizer
- Icons: `BarChart3` for spectrum, `Activity` for waveform (from lucide-react)

#### 4.3 Waveform Implementation
Create new component or mode in `Visualizer.tsx`:

```typescript
// For waveform, use getByteTimeDomainData instead of getByteFrequencyData
const dataArray = new Uint8Array(analyser.fftSize);
analyser.getByteTimeDomainData(dataArray);

// Draw as a line graph across the canvas
// Y-axis: amplitude (0-255, center at 128)
// X-axis: time (sample index)
```

#### 4.4 Visual Style
- Waveform line color: match current accent (`#818cf8` / indigo-400)
- Line width: 2px
- Optionally fill area under the wave with gradient
- Smooth the line using bezier curves or simple line segments

#### 4.5 Component Props Update
```typescript
interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  color: string;
  mode: 'spectrum' | 'waveform';  // NEW
}
```

#### 4.6 Acceptance Criteria
- [ ] Toggle switches between spectrum and waveform
- [ ] Waveform animates smoothly during playback
- [ ] Both modes work with the same AnalyserNode
- [ ] Preference persists across sessions
- [ ] Waveform is centered (silent = flat line in middle)

---

## Feature 5: Toast Notifications

### Description
Replace inline error messages and add success notifications using a toast system for non-blocking feedback.

### Requirements

#### 5.1 Toast Types
- **Success** (green): "Audio generated successfully", "Downloaded!", "Session exported"
- **Error** (red): API errors, validation errors, import failures
- **Info** (blue): "Playing...", "Copied to clipboard" (future)

#### 5.2 Toast Component
Create `components/Toast.tsx`:
```typescript
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;  // ms, default 3000
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}
```

#### 5.3 Positioning & Animation
- Position: Bottom-right corner, fixed
- Stack multiple toasts vertically (newest on top)
- Animation: Slide in from right, fade out on dismiss
- Auto-dismiss after `duration` (default 3 seconds)
- Click to dismiss early

#### 5.4 Toast Context/Hook
Create `hooks/useToast.ts` or simple context:
```typescript
const { addToast } = useToast();

// Usage:
addToast({ type: 'success', message: 'Audio generated!' });
addToast({ type: 'error', message: 'API rate limit exceeded' });
```

#### 5.5 Integration Points
Replace/supplement these with toasts:

| Current Behavior | New Toast |
|------------------|-----------|
| `setError(msg)` in catch blocks | `addToast({ type: 'error', message: msg })` |
| Successful generation (none) | `addToast({ type: 'success', message: 'Speech generated!' })` |
| Download complete (none) | `addToast({ type: 'success', message: 'Downloaded!' })` |
| Session exported (none) | `addToast({ type: 'success', message: 'Session exported!' })` |
| Session imported (none) | `addToast({ type: 'success', message: 'Session imported!' })` |
| Clear all complete (none) | `addToast({ type: 'info', message: 'History cleared' })` |

#### 5.6 Visual Design
```
┌─────────────────────────────────┐
│ ✓  Audio generated successfully │  ← icon + message
└─────────────────────────────────┘
   └─ green left border or bg tint
```

- Icons: `CheckCircle` (success), `XCircle` (error), `Info` (info)
- Max width: 320px
- Border-radius: 8px
- Shadow for elevation

#### 5.7 Acceptance Criteria
- [ ] Toasts appear for all success/error events
- [ ] Toasts auto-dismiss after 3 seconds
- [ ] Can manually dismiss by clicking
- [ ] Multiple toasts stack properly
- [ ] Toasts don't block interaction with the app
- [ ] Animations are smooth (use CSS transitions or framer-motion)

---

## Implementation Priority

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
| 1 | Toast Notifications | Low | High - improves all feedback |
| 2 | Dark/Light Mode | Medium | High - accessibility |
| 3 | Waveform View | Medium | Medium - visual polish |
| 4 | Voice Preview | Medium | Medium - UX improvement |
| 5 | 3+ Speakers | High | Medium - power user feature |

---

## Technical Notes

### Files to Create
- `components/Toast.tsx`
- `components/ToastContainer.tsx` (or combined)
- `hooks/useToast.ts` (or `contexts/ToastContext.tsx`)

### Files to Modify
- `App.tsx` - theme state, speaker array, toast integration
- `Visualizer.tsx` - add waveform mode
- `constants.ts` - voice previews, speaker colors
- `types.ts` - SpeakerConfig update, Toast type
- `index.html` - add theme class handling in `<script>` to prevent flash

### Dependencies
No new dependencies required. All features can be built with existing stack (React, Tailwind, Lucide).

---

## Out of Scope
- Backend/server changes
- User authentication
- Cloud sync
- Accessibility (a11y) audit (separate effort)
