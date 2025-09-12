# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 14 application for creating lyric timing data for YouTube videos. The app allows users to input lyrics with precise timestamps and export them in a custom format. It features a YouTube video player integration with playback controls and lyrics synchronization.

## Development Commands

- `npm run dev` - Start development server (port varies based on availability)
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

## Architecture and Code Organization

### Directory Structure (Recently Refactored)
```
app/                      # Next.js App Router pages
├── layout.tsx           # Root layout with metadata and styling
├── page.tsx             # Main lyrics typing application
└── globals.css          # Global styles with Tailwind CSS
components/
├── ui/                  # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── label.tsx
├── shared/              # Reusable shared components
│   ├── LyricsInputFields.tsx    # Common 4-line lyrics input
│   └── TimestampInput.tsx       # Timestamp input with capture button
├── LyricsInputSection.tsx       # Page add functionality
├── ScoreManagementSection.tsx   # Page edit/list functionality  
└── YouTubeVideoSection.tsx      # Video player controls
hooks/
├── useYouTube.ts               # Consolidated YouTube functionality
├── useScoreManagement.ts       # Lyrics entries CRUD operations
├── useKeyboardShortcuts.ts     # Global keyboard shortcuts
└── useFileOperations.ts        # Import/export functionality
lib/
├── types.ts                    # Centralized TypeScript interfaces
├── textUtils.ts                # Text processing & conversion
├── timeUtils.ts                # Time formatting utilities
├── youtubeUtils.ts            # YouTube URL parsing
└── utils.ts                   # General utilities (cn function)
```

### Key Technologies
- **Next.js 14.2.5** with App Router and TypeScript
- **React 18** with strict TypeScript configuration
- **Tailwind CSS v3** with proper configuration and utilities
- **shadcn/ui** components with class-variance-authority
- **Lucide React** icons for UI elements
- **YouTube IFrame API** for video integration

### Refactored Architecture Highlights

**Recent Consolidation Improvements:**
- **Hooks Consolidation**: All YouTube-related functionality (`useYouTubeAPI`, `useYouTubePlayer`, `useYouTubeVideo`) merged into single `useYouTube.ts`
- **Type Unification**: All TypeScript interfaces consolidated in `lib/types.ts` (eliminated duplicate definitions across components)
- **Component Reuse**: Common UI patterns extracted into `components/shared/` for reuse between add/edit functionality
- **Text Processing**: All text conversion utilities unified in `lib/textUtils.ts`

### Core Application Features

1. **YouTube Video Integration** (`useYouTube.ts` + `YouTubeVideoSection.tsx`)
   - Dynamic video loading via YouTube IFrame API with consolidated state management
   - Custom playback controls with keyboard shortcuts
   - Playback speed control (0.25x to 2x)
   - Precision seeking (5-second and 1-second increments)

2. **Lyrics Management System** (`useScoreManagement.ts`)
   - 4-line lyrics input with timestamp association using shared components
   - CRUD operations for lyrics entries (add, edit, delete)
   - Real-time lyrics highlighting during playback
   - Automatic sorting by timestamp

3. **File Operations** (`useFileOperations.ts`)
   - Custom export format: `総時間\n歌詞1/歌詞2/歌詞3/歌詞4/タイムスタンプ`
   - Import with validation and conflict resolution
   - Automatic song title detection from filename patterns (`曲名_YYYY-MM-DD_HH-MM-SS.txt`)
   - Batch operations (clear all entries)

4. **Keyboard Shortcuts** (`useKeyboardShortcuts.ts`)
   - `F2`: Capture current video timestamp
   - `Ctrl+Enter`: Add score entry  
   - `Ctrl+Space`: Toggle play/pause
   - `Ctrl+←/→`: 1-second seek backward/forward
   - `Tab`: Navigate between input fields

### Key Architectural Patterns

- **Hook-Based State Management**: Each major feature isolated in custom hooks with proper TypeScript typing
- **Shared Component Strategy**: Common UI patterns (lyrics input, timestamp capture) extracted for reuse between page add/edit functionality
- **Centralized Types**: All interfaces defined once in `lib/types.ts` (`ScoreEntry`, `YouTubePlayer`, `LyricsArray`)
- **Utility Separation**: Text processing, time formatting, YouTube parsing in dedicated lib files
- **Component Composition**: Main page orchestrates feature components rather than implementing directly

### Development Notes

- **Port Flexibility**: Dev server automatically finds available port (typically 3000-3007 range)
- **Cache Management**: Clear `.next` folder if experiencing build issues after refactoring
- **Type Safety**: All `any` types replaced with proper TypeScript interfaces from `lib/types.ts`
- **Import Paths**: Uses `@/` aliases for clean imports across the codebase
- **Text Processing**: Japanese text support with half-width to full-width conversion utilities