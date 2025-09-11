# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 14 application for creating lyric timing data for YouTube videos. The app allows users to input lyrics with precise timestamps and export them in a custom format. It features a YouTube video player integration with playback controls and lyrics synchronization.

## Development Commands

- `npm run dev` - Start development server (currently runs on http://localhost:3005)
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

## Architecture and Code Organization

### Directory Structure
```
app/                      # Next.js App Router pages
├── layout.tsx           # Root layout with metadata and styling
├── page.tsx             # Main lyrics typing application
└── globals.css          # Global styles with Tailwind CSS
components/ui/           # shadcn/ui components
├── button.tsx
├── card.tsx
├── input.tsx
└── label.tsx
lib/
└── utils.ts             # Utility functions (cn for className merging)
```

### Key Technologies
- **Next.js 14.2.5** with App Router and TypeScript
- **React 18** with strict TypeScript configuration
- **Tailwind CSS v3** with proper configuration and utilities
- **shadcn/ui** components with class-variance-authority
- **Lucide React** icons for UI elements
- **YouTube IFrame API** for video integration

### Main Application Features
The primary component (`app/page.tsx`) implements:

1. **YouTube Video Integration**
   - Dynamic video loading via YouTube IFrame API
   - Custom playback controls (play/pause, seek, speed control)
   - Real-time timestamp tracking with progress bar

2. **Lyrics Input System**
   - 4-line lyrics input with timestamp association
   - Automatic timestamp capture via spacebar
   - Text conversion utilities (half-width to full-width)
   - Kanji to hiragana conversion dictionary

3. **Score Management**
   - CRUD operations for lyrics entries (add, edit, delete)
   - Import/export functionality with custom text format
   - Real-time lyrics highlighting during playback
   - Batch operations (clear all entries)

4. **Keyboard Shortcuts**
   - Space: Capture current video timestamp
   - Ctrl+Enter: Add score entry
   - Tab: Navigate between input fields

5. **File Operations**
   - Export lyrics data in custom format with timestamps
   - Import previously saved lyrics files
   - Automatic song title detection from filenames

### Component Configuration
- Uses shadcn/ui components with Tailwind CSS v3
- Path aliases: `@/components`, `@/lib` configured in tsconfig.json
- Full-width Japanese character support with conversion utilities
- Responsive design with mobile-first approach

### Code Patterns
- Extensive use of React hooks for state management
- TypeScript interfaces for type safety (`ScoreEntry`)
- Custom utility functions for text processing and time formatting
- Event-driven YouTube API integration with comprehensive error handling
- Real-time UI updates synchronized with video playback

### Project Status
✅ **New Clean Build Completed**
- Rebuilt from scratch with Next.js 14 and stable dependencies
- All original functionality restored and working
- No 404 errors or TypeScript compilation issues
- Properly configured Tailwind CSS v3
- All UI components functioning correctly

### YouTube API Integration
The application loads the YouTube IFrame API dynamically and provides:
- Video embedding with custom player controls
- Playback speed control (0.25x to 2x)
- Seek functionality with precision timestamp control
- Real-time current time tracking for lyrics synchronization