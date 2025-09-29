# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lyric Data Creator is a Next.js 14 web application for creating synchronized lyric timing data for YouTube videos. The app allows users to input lyrics and capture precise timestamps while watching YouTube videos, then export the data in various formats.

## Development Commands

### Core Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production (static export)
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run full test suite (lint + type-check + build)
- `npm run preview` - Build and serve locally with static server
- `npm run deploy-check` - Pre-deployment validation

### Dependencies
- Kuromoji dictionaries are automatically installed to `public/dict/` via postinstall script
- Production build uses static export with GitHub Pages configuration

## Architecture

### Application Structure
The app follows Next.js 14 App Router patterns with a custom hook-based architecture:

**Main Layout:**
- `app/page.tsx` - Main application component with two-column layout
- Left column: YouTube video player and lyrics input
- Right column: Score management (saved lyrics pages)

### Core Hooks System

**State Management Hooks:**
- `useYouTube` - YouTube player integration, video controls, playback state
- `useScoreManagement` - Lyrics entries, timestamps, editing state, undo functionality
- `useKeyboardShortcuts` - Global keyboard shortcuts (F2, Ctrl+Enter, etc.)
- `useFileOperations` - Import/export functionality for lyric data files
- `useLyricsCopyPaste` - Clipboard integration for lyrics
- `useAutoScroll` - Auto-scroll behavior for lyrics list

### Key Data Types
- `ScoreEntry` - Individual lyric page with timestamp and 4-line lyrics array
- `YouTubePlayer` - Interface for YouTube IFrame API player methods
- `LyricsArray` - Tuple type for 4-line lyrics format

### Component Architecture
- **YouTubeVideoSection** - Video player with custom controls
- **LyricsEditCard** - Input form for lyrics and timestamps
- **ScoreManagementSection** - List management for saved lyric pages
- **HelpSection** - Keyboard shortcuts and usage instructions

### Utility Libraries
- `lib/youtubeUtils.ts` - YouTube URL/ID extraction and validation
- `lib/timeUtils.ts` - Time formatting and parsing utilities
- `lib/textUtils.ts` - Text processing and character conversion
- `lib/errorUtils.ts` - Centralized error handling
- `lib/kpmUtils.ts` - KPM (Keystrokes Per Minute) calculation
- `lib/hiraganaUtils.ts` - Japanese text processing with Kuroshiro
- `lib/lrcUtils.ts` - LRC format export utilities

## Key Features

### YouTube Integration
- YouTube IFrame API for video playback control
- Custom video controls with precise seeking (1s/5s intervals)
- Playback rate adjustment (0.25x - 2x)
- Volume control and muting

### Lyrics Input System
- 4-line lyrics input format
- Real-time timestamp capture with offset adjustment
- Half-width to full-width character conversion
- Clipboard paste support for bulk lyrics entry

### Export Formats
- Custom format: `timestamp/line1/line2/line3/line4/totalDuration`
- LRC format support
- Automatic filename generation with timestamp

## Development Notes

### Configuration
- Static export configuration for GitHub Pages deployment
- Base path `/LyricDataCreator` in production
- TypeScript strict mode enabled
- Path aliases: `@/*` maps to project root

### External Dependencies
- Kuroshiro + Kuromoji for Japanese text processing
- shadcn/ui components with Tailwind CSS
- Sonner for toast notifications
- YouTube IFrame API for video integration

### State Persistence
- Timestamp offset saved to localStorage
- Undo functionality for score entry operations
- Song title persistence across sessions

### Important Notes
- This project implements a KPM (Keys Per Minute) calculation feature to measure typing speed. Be absolutely careful not to confuse kpm and kmp during coding.