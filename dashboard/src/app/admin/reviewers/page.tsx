'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useReviewerStats, useUpdateReviewer } from '@/hooks/useAdminMetrics'
import { formatDistanceToNow } from 'date-fns'
import {
  User,
  Search,
  Mail,
  Edit,
  TrendingUp,
  Clock,
  Flame,
  ArrowUpDown,
  ArrowLeft,
} from 'lucide-react'

export default function ReviewersPage() {
  const { data: reviewers, isLoading } = useReviewerStats()
  const updateReviewer = useUpdateReviewer()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<'name' | 'reviews' | 'agreement' | 'streak'>(
    'reviews'
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (!reviewers) {
    return <div>No reviewers found</div>
  }

  // Filter reviewers
  let filtered = reviewers.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Sort reviewers
  filtered.sort((a, b) => {
    let comparison = 0
    switch (sortColumn) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'reviews':
        comparison = a.reviewCount - b.reviewCount
        break
      case 'agreement':
        comparison = a.agreementRate - b.agreementRate
        break
      case 'streak':
        comparison = a.streak - b.streak
        break
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const toggleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/admin'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reviewer Management</h1>
            <p className="text-muted-foreground">
              Manage reviewers and view detailed statistics
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reviewers by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              Add Reviewer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reviewers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Reviewers ({filtered.length})</CardTitle>
          <CardDescription>
            Click column headers to sort
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort('name')}
                      className="font-semibold"
                    >
                      Reviewer
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="p-3 text-center">Role</th>
                  <th className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort('reviews')}
                      className="font-semibold"
                    >
                      Reviews
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort('agreement')}
                      className="font-semibold"
                    >
                      Agreement
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort('streak')}
                      className="font-semibold"
                    >
                      Streak
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="p-3 text-center">Preferences</th>
                  <th className="p-3 text-left">Last Active</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((reviewer, idx) => (
                  <tr
                    key={reviewer.id}
                    className={`border-t hover:bg-muted/30 transition-colors ${
                      idx % 2 === 0 ? 'bg-muted/10' : ''
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{reviewer.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {reviewer.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={reviewer.role === 'admin' ? 'default' : 'secondary'}
                      >
                        {reviewer.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="font-semibold">{reviewer.reviewCount}</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(reviewer.avgReviewTime / 60)}s avg
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold">
                          {(reviewer.agreementRate * 100).toFixed(0)}%
                        </span>
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {reviewer.streak > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-semibold">{reviewer.streak}</span>
                          <Flame className="h-4 w-4 text-orange-500" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <Badge variant="outline" className="text-xs">
                          A: {reviewer.preferences.A}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          B: {reviewer.preferences.B}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Tie: {reviewer.preferences.tie}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-3">
                      {reviewer.lastActive ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDistanceToNow(reviewer.lastActive, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
