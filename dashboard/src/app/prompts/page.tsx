import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Plus, GitBranch } from 'lucide-react'

export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prompts</h1>
          <p className="text-muted-foreground">
            Manage prompt versions and branches
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <GitBranch className="mr-2 h-4 w-4" />
            New Branch
          </Button>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            New Version
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt Versions</CardTitle>
          <CardDescription>
            Track and manage different versions of agent prompts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No prompts yet</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Prompt versions will appear here after running APO training.
              <br />
              Use lightning:optimize to generate optimized prompt variations.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Branches</CardTitle>
            <CardDescription>Experimental prompt branches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No active branches
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Comparison</CardTitle>
            <CardDescription>Version metrics overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No performance data available
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Training History</CardTitle>
          <CardDescription>
            Recent APO training runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No training runs yet
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
