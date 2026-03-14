'use client'

import { cn } from '@/lib/utils'

// ── Loader wrapper: centers content with optional message ──────────
function LoaderShell({
  children,
  message,
  className,
  fullScreen = false,
}: {
  children: React.ReactNode
  message?: string
  className?: string
  fullScreen?: boolean
}) {
  return (
    <div className={cn(
      'flex items-center justify-center',
      fullScreen ? 'min-h-screen' : 'h-40',
      className,
    )}>
      <div className="flex flex-col items-center gap-3">
        {children}
        {message && (
          <p className="text-sm text-gray-500 animate-pulse">{message}</p>
        )}
      </div>
    </div>
  )
}

// ── #2 Sprint Bars — for Sprint Overview ───────────────────────────
export function SprintBarsLoader({
  message = 'Crunching sprint data...',
  fullScreen = false,
  className,
}: { message?: string; fullScreen?: boolean; className?: string }) {
  return (
    <LoaderShell message={message} fullScreen={fullScreen} className={className}>
      <div className="flex items-end gap-[5px] h-8">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-[5px] rounded-[3px] bg-blue-500"
            style={{
              animation: 'sprint-bar 1s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
              height: '8px',
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes sprint-bar {
          0%, 100% { height: 8px; opacity: 0.4; }
          50% { height: 32px; opacity: 1; }
        }
      `}</style>
    </LoaderShell>
  )
}

// ── #3 Kanban Cards — for Board ────────────────────────────────────
export function KanbanCardsLoader({
  message = 'Loading your board...',
  fullScreen = false,
  className,
}: { message?: string; fullScreen?: boolean; className?: string }) {
  const colors = ['bg-blue-300', 'bg-yellow-300', 'bg-purple-300', 'bg-green-300']
  return (
    <LoaderShell message={message} fullScreen={fullScreen} className={className}>
      <div className="flex gap-[6px]">
        {colors.map((color, i) => (
          <div
            key={i}
            className={cn('w-5 h-6 rounded', color)}
            style={{
              animation: 'kanban-slide 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes kanban-slide {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </LoaderShell>
  )
}

// ── #5 Progress Slide — for Epics ──────────────────────────────────
export function ProgressSlideLoader({
  message = 'Loading epics...',
  fullScreen = false,
  className,
}: { message?: string; fullScreen?: boolean; className?: string }) {
  return (
    <LoaderShell message={message} fullScreen={fullScreen} className={className}>
      <div className="w-[120px] h-[3px] bg-gray-200 rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{
            width: '40%',
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            animation: 'progress-slide 1.2s ease-in-out infinite',
          }}
        />
      </div>
      <style jsx>{`
        @keyframes progress-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </LoaderShell>
  )
}

// ── #6 Skeleton Cards — for Profile / Settings ─────────────────────
export function SkeletonLoader({
  message,
  fullScreen = false,
  className,
}: { message?: string; fullScreen?: boolean; className?: string }) {
  return (
    <LoaderShell message={message} fullScreen={fullScreen} className={className}>
      <div className="w-[200px] space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 rounded-full bg-gray-200 animate-pulse w-[85%]" />
            <div className="h-2.5 rounded-full bg-gray-200 animate-pulse w-[60%]" />
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-gray-200 animate-pulse w-full" />
        <div className="h-2.5 rounded-full bg-gray-200 animate-pulse w-[75%]" />
      </div>
    </LoaderShell>
  )
}

// ── #8 Spin Arc — for Detail pages ─────────────────────────────────
export function SpinArcLoader({
  message = 'Loading...',
  fullScreen = false,
  className,
}: { message?: string; fullScreen?: boolean; className?: string }) {
  return (
    <LoaderShell message={message} fullScreen={fullScreen} className={className}>
      <div
        className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-blue-500"
        style={{ animation: 'spin-arc 0.8s linear infinite' }}
      />
      <style jsx>{`
        @keyframes spin-arc {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </LoaderShell>
  )
}

// ── #9 Morphing Shape — for Design Board ───────────────────────────
export function MorphingShapeLoader({
  message = 'Loading designs...',
  fullScreen = false,
  className,
}: { message?: string; fullScreen?: boolean; className?: string }) {
  return (
    <LoaderShell message={message} fullScreen={fullScreen} className={className}>
      <div
        className="w-6 h-6 bg-blue-500 rounded"
        style={{ animation: 'morph 1.2s ease-in-out infinite' }}
      />
      <style jsx>{`
        @keyframes morph {
          0%, 100% { border-radius: 4px; transform: rotate(0deg) scale(1); }
          25% { border-radius: 50%; transform: rotate(90deg) scale(0.8); }
          50% { border-radius: 4px; transform: rotate(180deg) scale(1); }
          75% { border-radius: 50%; transform: rotate(270deg) scale(0.8); }
        }
      `}</style>
    </LoaderShell>
  )
}

// ── #12 Stacked Cards — for Backlog ────────────────────────────────
export function StackedCardsLoader({
  message = 'Organizing your backlog...',
  fullScreen = false,
  className,
}: { message?: string; fullScreen?: boolean; className?: string }) {
  const colors = ['bg-blue-300', 'bg-purple-300', 'bg-green-300']
  return (
    <LoaderShell message={message} fullScreen={fullScreen} className={className}>
      <div className="relative w-8 h-7">
        {colors.map((color, i) => (
          <div
            key={i}
            className={cn('absolute left-1 w-6 h-4 rounded-[3px]', color)}
            style={{
              top: `${i * 4}px`,
              zIndex: 3 - i,
              animation: 'stack-shuffle 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes stack-shuffle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
          50% { transform: translateY(-6px) scale(1.05); opacity: 1; }
        }
      `}</style>
    </LoaderShell>
  )
}
