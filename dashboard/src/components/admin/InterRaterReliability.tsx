'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useInterRaterReliability } from '@/hooks/useAdminMetrics'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

export function InterRaterReliability() {
  const { data: reliability, isLoading } = useInterRaterReliability()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inter-Rater Reliability</CardTitle>
          <CardDescription>Loading reliability metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!reliability) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inter-Rater Reliability</CardTitle>
          <CardDescription>No reliability data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Cohen's Kappa interpretation
  const getKappaInterpretation = (kappa: number) => {
    if (kappa < 0) return { label: 'Poor', color: 'destructive', icon: XCircle }
    if (kappa < 0.2) return { label: 'Slight', color: 'destructive', icon: AlertCircle }
    if (kappa < 0.4) return { label: 'Fair', color: 'secondary', icon: AlertCircle }
    if (kappa < 0.6) return { label: 'Moderate', color: 'default', icon: CheckCircle }
    if (kappa < 0.8) return { label: 'Substantial', color: 'default', icon: CheckCircle }
    return { label: 'Almost Perfect', color: 'default', icon: CheckCircle }
  }

  const overallInterpretation = getKappaInterpretation(reliability.overallKappa)
  const OverallIcon = overallInterpretation.icon

  // Get pairwise kappas
  const reviewerIds = Object.keys(reliability.pairwiseKappa)
  const pairwiseValues = reviewerIds.flatMap((r1) =>
    Object.entries(reliability.pairwiseKappa[r1] || {}).map(([r2, kappa]) => ({
      pair: `${r1.slice(0, 8)} ↔ ${r2.slice(0, 8)}`,
      kappa,
    }))
  )

  // Sort by kappa
  pairwiseValues.sort((a, b) => b.kappa - a.kappa)

  // Confusion matrix total
  const confusionTotal = Object.values(reliability.confusionMatrix).reduce(
    (sum, count) => sum + count,
    0
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inter-Rater Reliability</CardTitle>
        <CardDescription>
          Agreement metrics across {reliability.sampleSize.toLocaleString()} reviews
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Kappa */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Overall Cohen's Kappa
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl font-bold">
                  {reliability.overallKappa.toFixed(3)}
                </span>
                <Badge variant={overallInterpretation.color as any}>
                  {overallInterpretation.label}
                </Badge>
              </div>
            </div>
            <OverallIcon className="h-12 w-12 text-muted-foreground" />
          </div>

          {/* Interpretation Guide */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span>&lt; 0.2: Slight agreement</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span>0.2-0.4: Fair</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>0.4-0.6: Moderate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>0.6-0.8: Substantial</span>
            </div>
          </div>

          {/* Pairwise Kappas */}
          {pairwiseValues.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Pairwise Agreement</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pairwiseValues.slice(0, 10).map((pair, idx) => {
                  const interp = getKappaInterpretation(pair.kappa)
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 border rounded text-sm"
                    >
                      <span className="text-muted-foreground font-mono">
                        {pair.pair}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pair.kappa.toFixed(3)}</span>
                        <Badge variant="outline" className="text-xs">
                          {interp.label}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Confusion Matrix */}
          <div>
            <h3 className="text-sm font-medium mb-3">Preference Confusion Matrix</h3>
            <div className="grid grid-cols-4 gap-1 text-xs">
              <div className="p-2 bg-muted/30 font-medium"></div>
              <div className="p-2 bg-muted/30 font-medium text-center">A</div>
              <div className="p-2 bg-muted/30 font-medium text-center">B</div>
              <div className="p-2 bg-muted/30 font-medium text-center">Tie</div>

              <div className="p-2 bg-muted/30 font-medium">A</div>
              <div className="p-2 border text-center bg-green-500/10">
                {reliability.confusionMatrix.AA}
                {confusionTotal > 0 && (
                  <div className="text-muted-foreground">
                    {((reliability.confusionMatrix.AA / confusionTotal) * 100).toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="p-2 border text-center bg-red-500/10">
                {reliability.confusionMatrix.AB}
              </div>
              <div className="p-2 border text-center bg-yellow-500/10">
                {reliability.confusionMatrix.ATie}
              </div>

              <div className="p-2 bg-muted/30 font-medium">B</div>
              <div className="p-2 border text-center bg-red-500/10">
                {reliability.confusionMatrix.BA}
              </div>
              <div className="p-2 border text-center bg-green-500/10">
                {reliability.confusionMatrix.BB}
                {confusionTotal > 0 && (
                  <div className="text-muted-foreground">
                    {((reliability.confusionMatrix.BB / confusionTotal) * 100).toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="p-2 border text-center bg-yellow-500/10">
                {reliability.confusionMatrix.BTie}
              </div>

              <div className="p-2 bg-muted/30 font-medium">Tie</div>
              <div className="p-2 border text-center bg-yellow-500/10">
                {reliability.confusionMatrix.TieA}
              </div>
              <div className="p-2 border text-center bg-yellow-500/10">
                {reliability.confusionMatrix.TieB}
              </div>
              <div className="p-2 border text-center bg-green-500/10">
                {reliability.confusionMatrix.TieTie}
                {confusionTotal > 0 && (
                  <div className="text-muted-foreground">
                    {((reliability.confusionMatrix.TieTie / confusionTotal) * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Rows: Reviewer 1 preference, Columns: Reviewer 2 preference
            </p>
          </div>

          {/* Calibration Recommendations */}
          {reliability.overallKappa < 0.6 && (
            <div className="p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Calibration Recommended
              </h3>
              <p className="text-sm text-muted-foreground">
                Agreement is below 0.6 (moderate). Consider:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li>Running calibration sessions with reviewers</li>
                <li>Clarifying evaluation criteria</li>
                <li>Reviewing disagreement cases together</li>
                <li>Updating reviewer guidelines</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
