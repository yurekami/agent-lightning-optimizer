'use client'

import { useEffect, useRef, useState } from 'react'
import { LineageNode } from '@/lib/prompts'

// =============================================================================
// TYPES
// =============================================================================

interface LineageGraphProps {
  lineage: LineageNode[]
  selectedVersionId?: string | null
  productionVersionId?: string | null
  onSelectVersion: (versionId: string) => void
}

interface GraphNode {
  id: string
  version: number
  depth: number
  x: number
  y: number
  status: string
  branchName: string
  fitness: number | null
  parentIds: string[]
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LineageGraph({
  lineage,
  selectedVersionId,
  productionVersionId,
  onSelectVersion,
}: LineageGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Layout configuration
  const NODE_RADIUS = 20
  const VERTICAL_SPACING = 80
  const HORIZONTAL_SPACING = 120

  // Calculate node positions
  const nodes: GraphNode[] = lineage.map((node, index) => {
    // Group by depth (generation)
    const sameDepthNodes = lineage.filter((n) => n.depth === node.depth)
    const indexInDepth = sameDepthNodes.findIndex((n) => n.id === node.id)

    return {
      id: node.id,
      version: node.version,
      depth: node.depth,
      x: node.depth * HORIZONTAL_SPACING,
      y: indexInDepth * VERTICAL_SPACING,
      status: node.status,
      branchName: node.branchName,
      fitness: node.fitness.winRate,
      parentIds: node.parentIds,
    }
  })

  // Calculate edges
  const edges: Array<{ from: string; to: string }> = []
  for (const node of lineage) {
    for (const parentId of node.parentIds) {
      edges.push({ from: parentId, to: node.id })
    }
  }

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle mouse events for pan
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((prev) => Math.max(0.1, Math.min(3, prev * delta)))
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Version Lineage</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
            className="rounded border px-2 py-1 text-sm hover:bg-gray-100"
          >
            -
          </button>
          <span className="text-sm text-gray-600">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            className="rounded border px-2 py-1 text-sm hover:bg-gray-100"
          >
            +
          </button>
          <button
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="overflow-hidden rounded-lg border bg-gray-50">
        <svg
          ref={svgRef}
          className="h-96 w-full cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <g transform={`translate(${pan.x + 50}, ${pan.y + 50}) scale(${zoom})`}>
            {/* Draw edges */}
            {edges.map((edge, index) => {
              const fromNode = nodes.find((n) => n.id === edge.from)
              const toNode = nodes.find((n) => n.id === edge.to)

              if (!fromNode || !toNode) return null

              // Check if this is a crossover edge (multiple parents)
              const isCrossover = toNode.parentIds.length > 1

              return (
                <line
                  key={`edge-${index}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={isCrossover ? '#9333ea' : '#cbd5e1'}
                  strokeWidth={isCrossover ? 2 : 1}
                  strokeDasharray={isCrossover ? '5,5' : undefined}
                  markerEnd="url(#arrowhead)"
                />
              )
            })}

            {/* Draw nodes */}
            {nodes.map((node) => (
              <GraphNodeComponent
                key={node.id}
                node={node}
                isSelected={node.id === selectedVersionId}
                isProduction={node.id === productionVersionId}
                radius={NODE_RADIUS}
                onClick={() => onSelectVersion(node.id)}
              />
            ))}
          </g>

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#cbd5e1" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-blue-500" />
          <span>Production</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-blue-500 bg-white" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="4">
            <line x1="0" y1="2" x2="24" y2="2" stroke="#9333ea" strokeWidth="2" strokeDasharray="5,5" />
          </svg>
          <span>Crossover</span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// GRAPH NODE COMPONENT
// =============================================================================

function GraphNodeComponent({
  node,
  isSelected,
  isProduction,
  radius,
  onClick,
}: {
  node: GraphNode
  isSelected: boolean
  isProduction: boolean
  radius: number
  onClick: () => void
}) {
  const statusColor = {
    candidate: '#fbbf24',
    approved: '#10b981',
    production: '#3b82f6',
    retired: '#9ca3af',
  }[node.status] || '#9ca3af'

  return (
    <g
      onClick={onClick}
      className="cursor-pointer"
      style={{ pointerEvents: 'all' }}
    >
      {/* Outer ring for selection */}
      {isSelected && (
        <circle
          cx={node.x}
          cy={node.y}
          r={radius + 4}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={3}
        />
      )}

      {/* Main circle */}
      <circle
        cx={node.x}
        cy={node.y}
        r={radius}
        fill={isProduction ? '#3b82f6' : statusColor}
        stroke="#fff"
        strokeWidth={2}
      />

      {/* Version number */}
      <text
        x={node.x}
        y={node.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize="12"
        fontWeight="bold"
      >
        v{node.version}
      </text>

      {/* Fitness score (if available) */}
      {node.fitness !== null && (
        <text
          x={node.x}
          y={node.y + radius + 12}
          textAnchor="middle"
          fill="#6b7280"
          fontSize="10"
        >
          {Math.round(node.fitness * 100)}%
        </text>
      )}

      {/* Production badge */}
      {isProduction && (
        <rect
          x={node.x - 15}
          y={node.y - radius - 16}
          width="30"
          height="12"
          fill="#3b82f6"
          rx="2"
        />
      )}
      {isProduction && (
        <text
          x={node.x}
          y={node.y - radius - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="8"
          fontWeight="bold"
        >
          PROD
        </text>
      )}
    </g>
  )
}
