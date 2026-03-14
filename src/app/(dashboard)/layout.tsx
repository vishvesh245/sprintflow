import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopNav } from '@/components/layout/TopNav'
import { TeamSelectionModal } from '@/components/modals/TeamSelectionModal'
import { IssueSlideOverWrapper } from '@/components/issues/IssueSlideOverWrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login')
  }

  // teamId is already in the JWT session (set by auth callbacks) — no extra DB call needed
  const hasTeam = !!(session.user as any).teamId

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <TopNav />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {!hasTeam ? (
            <TeamSelectionModal userId={session.user.id} />
          ) : (
            <IssueSlideOverWrapper>{children}</IssueSlideOverWrapper>
          )}
        </main>
      </div>
    </div>
  )
}
