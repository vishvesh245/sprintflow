'use client'

interface SprintProgressProps {
  total: number
  done: number
  teamColor: 'blue' | 'green' | 'purple'
}

const COLORS = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  purple: 'bg-purple-600',
}

export default function SprintProgress({ total, done, teamColor }: SprintProgressProps) {
  const percentage = total > 0 ? (done / total) * 100 : 0
  const color = COLORS[teamColor]

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Progress</span>
        <span className="text-xs font-semibold text-gray-900">{Math.round(percentage)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`${color} h-full transition-all duration-300 rounded-full`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  )
}
