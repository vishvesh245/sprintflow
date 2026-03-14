'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Plus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDesignTodos, DesignTodo } from '@/hooks/useDesignTodos'
import { toast } from 'sonner'

interface DesignItemChecklistProps {
  designItemId: string
}

export function DesignItemChecklist({ designItemId }: DesignItemChecklistProps) {
  const queryClient = useQueryClient()
  const { todos, isLoading } = useDesignTodos(designItemId)

  const [expanded, setExpanded] = useState(true)
  const [newTodoText, setNewTodoText] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const completedCount = todos.filter((t) => t.completed).length
  const totalCount = todos.length

  const handleAddTodo = async () => {
    const text = newTodoText.trim()
    if (!text || saving) return

    setSaving(true)
    try {
      const res = await fetch(`/api/design-items/${designItemId}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Failed to create todo')
      const newTodo: DesignTodo = await res.json()
      // Append the new todo to the cache directly instead of refetching
      queryClient.setQueryData<DesignTodo[]>(
        ['design-todos', designItemId],
        (old) => [...(old ?? []), newTodo]
      )
      setNewTodoText('')
      setAdding(false)
    } catch (error) {
      toast.error('Failed to add checklist item')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleTodo = async (todo: DesignTodo) => {
    // Optimistic update
    queryClient.setQueryData<DesignTodo[]>(
      ['design-todos', designItemId],
      (old) =>
        old?.map((t) =>
          t.id === todo.id ? { ...t, completed: !t.completed } : t
        )
    )

    try {
      const res = await fetch(
        `/api/design-items/${designItemId}/todos/${todo.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !todo.completed }),
        }
      )
      if (!res.ok) throw new Error('Failed to toggle todo')
      // Update cache with server response instead of refetching
      const updated: DesignTodo = await res.json()
      queryClient.setQueryData<DesignTodo[]>(
        ['design-todos', designItemId],
        (old) =>
          old?.map((t) => (t.id === updated.id ? updated : t))
      )
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData<DesignTodo[]>(
        ['design-todos', designItemId],
        (old) =>
          old?.map((t) =>
            t.id === todo.id ? { ...t, completed: todo.completed } : t
          )
      )
      toast.error('Failed to update checklist item')
    }
  }

  const handleDeleteTodo = async (todoId: string) => {
    // Save current list for rollback
    const previousTodos = queryClient.getQueryData<DesignTodo[]>(
      ['design-todos', designItemId]
    )

    // Optimistic update
    queryClient.setQueryData<DesignTodo[]>(
      ['design-todos', designItemId],
      (old) => old?.filter((t) => t.id !== todoId)
    )

    try {
      const res = await fetch(
        `/api/design-items/${designItemId}/todos/${todoId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to delete todo')
      // Success — optimistic state is correct, no refetch needed
    } catch (error) {
      // Rollback to saved snapshot
      queryClient.setQueryData(['design-todos', designItemId], previousTodos)
      toast.error('Failed to delete checklist item')
    }
  }

  if (isLoading) return null

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <CheckSquare className="h-4 w-4 text-blue-500" />
          Checklist
          <span className="text-xs font-medium text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
            {completedCount}/{totalCount}
          </span>
        </button>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add item
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-gray-100">
          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="px-4 py-2 bg-white">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Todo rows */}
          {todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors group"
            >
              <button
                onClick={() => handleToggleTodo(todo)}
                className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all',
                  todo.completed
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 hover:border-blue-500'
                )}
              >
                {todo.completed && (
                  <svg
                    width="10"
                    height="10"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span
                className={cn(
                  'text-sm truncate flex-1',
                  todo.completed
                    ? 'line-through text-gray-400'
                    : 'text-gray-800'
                )}
              >
                {todo.text}
              </span>
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-0.5 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Empty state */}
          {totalCount === 0 && !adding && (
            <p className="px-4 py-3 text-xs text-gray-400 italic bg-white">
              No items yet.
            </p>
          )}

          {/* Inline add form */}
          {adding && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-t border-blue-100">
              <input
                autoFocus
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTodo()
                  if (e.key === 'Escape') {
                    setAdding(false)
                    setNewTodoText('')
                  }
                }}
                placeholder="Add a checklist item…"
                className="flex-1 rounded border border-blue-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddTodo}
                disabled={saving || !newTodoText.trim()}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '…' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setAdding(false)
                  setNewTodoText('')
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
