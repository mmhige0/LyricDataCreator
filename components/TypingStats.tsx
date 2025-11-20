interface TypingStatsProps {
  currentTime: number
  duration: number
  combo: number
  totalMiss: number
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const TypingStats = ({ currentTime, duration, combo, totalMiss }: TypingStatsProps) => {
  return (
    <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 px-1">
      <div className="flex items-center space-x-4">
        <span className="font-semibold">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <span>combo {combo}</span>
        <span>ミス: {totalMiss}</span>
      </div>
    </div>
  )
}
