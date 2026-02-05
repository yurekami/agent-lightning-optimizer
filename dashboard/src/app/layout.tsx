import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ClipboardList, Sparkles, Settings, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { QueryProvider } from '@/components/providers/QueryProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Agent Lightning - Prompt Optimizer',
  description: 'AI-powered prompt optimization through human feedback',
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Reviews', href: '/reviews', icon: ClipboardList },
  { name: 'Prompts', href: '/prompts', icon: Sparkles },
  { name: 'Admin', href: '/admin', icon: Settings },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <QueryProvider>
          <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-card">
              <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-16 items-center border-b border-border px-6">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <span className="ml-2 text-lg font-semibold">
                    Agent Lightning
                  </span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 px-3 py-4">
                  {navigation.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </Link>
                    )
                  })}
                </nav>

                {/* User Info */}
                <div className="border-t border-border p-4">
                  <div className="flex items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      U
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">User</p>
                      <p className="text-xs text-muted-foreground">Reviewer</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
              <div className="container mx-auto p-6">{children}</div>
            </main>
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}
