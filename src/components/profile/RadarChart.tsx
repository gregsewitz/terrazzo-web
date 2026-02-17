'use client';

import { AXIS_COLORS } from '@/constants/profile';

interface RadarChartProps {
  data: Array<{ axis: string; value: number }>;
  size?: number;
}

export default function RadarChart({ data, size = 280 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = (size / 2) * 0.72;
  const n = data.length;
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const getPoint = (i: number, radius: number) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  const gridPolygons = gridLevels.map((level) =>
    data.map((_, i) => getPoint(i, maxRadius * level)).map(p => `${p.x},${p.y}`).join(' ')
  );

  const dataPoints = data.map((d, i) => getPoint(i, maxRadius * d.value));
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
  const outerPoints = data.map((_, i) => getPoint(i, maxRadius));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5f5f0" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#f5f5f0" stopOpacity={0.05} />
        </radialGradient>
      </defs>

      {/* Grid polygons */}
      {gridPolygons.map((points, i) => (
        <polygon
          key={`grid-${i}`}
          points={points}
          fill="none"
          stroke="rgba(245,245,240,0.06)"
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines (colored per dimension) */}
      {data.map((d, i) => {
        const outer = getPoint(i, maxRadius);
        const color = AXIS_COLORS[d.axis] || '#8b6b4a';
        return (
          <line
            key={`axis-${i}`}
            x1={cx} y1={cy}
            x2={outer.x} y2={outer.y}
            stroke={color}
            strokeOpacity={0.5}
            strokeWidth={0.8}
          />
        );
      })}

      {/* Data polygon with gradient fill */}
      <polygon
        points={dataPolygon}
        fill="url(#radarFill)"
        stroke="#f5f5f0"
        strokeWidth={1.5}
        strokeOpacity={0.6}
      />

      {/* Outer endpoint dots (faded, at max radius) */}
      {outerPoints.map((p, i) => {
        const color = AXIS_COLORS[data[i].axis] || '#8b6b4a';
        return (
          <circle
            key={`outer-${i}`}
            cx={p.x} cy={p.y} r={2}
            fill={color}
            fillOpacity={0.4}
          />
        );
      })}

      {/* Data point dots (solid, colored) */}
      {dataPoints.map((p, i) => {
        const color = AXIS_COLORS[data[i].axis] || '#8b6b4a';
        return (
          <g key={`data-${i}`}>
            <circle cx={p.x} cy={p.y} r={3.5} fill={color} />
            <circle cx={p.x} cy={p.y} r={1.5} fill="white" />
          </g>
        );
      })}

      {/* Axis labels */}
      {data.map((d, i) => {
        const labelPoint = getPoint(i, maxRadius * 1.22);
        return (
          <text
            key={`label-${i}`}
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#f5f5f0"
            fontSize={10}
            fontFamily="'Space Mono', monospace"
            opacity={0.7}
          >
            {d.axis}
          </text>
        );
      })}

      {/* Numeric values */}
      {data.map((d, i) => {
        const valPoint = getPoint(i, maxRadius * 1.38);
        return (
          <text
            key={`val-${i}`}
            x={valPoint.x}
            y={valPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#f5f5f0"
            fontSize={9}
            fontFamily="'Space Mono', monospace"
            opacity={0.5}
          >
            {Math.round(d.value * 100)}
          </text>
        );
      })}
    </svg>
  );
}
