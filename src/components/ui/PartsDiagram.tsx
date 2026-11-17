import { Link, useHref } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { CatalogPart } from '../../types';
import styles from '../../styles/parts.module.css';

interface PartsDiagramProps {
  parts: CatalogPart[];
  hrefForPart: (partSlug: string) => string;
  label: string;
  vehicleLabel: string;
}

const X = 300;
const Y = 145;

/**
 * A lightweight representative exploded diagram. Real production diagrams should
 * come from a licensed OEM source; this schematic validates the hotspot pattern.
 */
export default function PartsDiagram({ parts, hrefForPart, label, vehicleLabel }: PartsDiagramProps) {
  const count = Math.min(parts.length, 9);
  const positions = Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(count, 1)) * Math.PI * 2;
    return {
      x: X + Math.cos(angle) * 220,
      y: Y + Math.sin(angle) * 100,
    };
  });

  return (
    <div className={`card ${styles.diagramCard}`}>
      <svg
        className={styles.diagramSvg}
        viewBox="0 0 600 300"
        role="group"
        aria-labelledby="parts-diagram-title parts-diagram-desc"
      >
        <title id="parts-diagram-title">{label} — representative exploded diagram</title>
        <desc id="parts-diagram-desc">
          Numbered hotspots link to the parts list below. Use the text links after the diagram for
          keyboard navigation and an accessible alternative.
        </desc>

        <defs>
          <radialGradient id="assembly-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(232,184,75,0.18)" />
            <stop offset="100%" stopColor="rgba(232,184,75,0)" />
          </radialGradient>
        </defs>

        <circle cx={X} cy={Y} r="112" fill="url(#assembly-glow)" />
        <rect
          x={X - 78}
          y={Y - 42}
          width="156"
          height="84"
          rx="14"
          fill="var(--bg-elevated)"
          stroke="var(--border-amber)"
          strokeDasharray="5 5"
        />
        <text x={X} y={Y - 5} textAnchor="middle" fill="var(--amber)" fontSize="13" fontFamily="var(--font-mono)">
          {vehicleLabel}
        </text>
        <text x={X} y={Y + 16} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-mono)">
          {label}
        </text>

        {positions.map((position, index) => {
          const part = parts[index];
          const href = hrefForPart(part.slug);
          return (
            <g key={part.slug}>
              <line
                x1={X}
                y1={Y}
                x2={position.x}
                y2={position.y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <SvgLink href={href} label={`${index + 1}. ${part.name}, OEM ${part.oemNumber}`} x={position.x} y={position.y} index={index} />
            </g>
          );
        })}
      </svg>

      <div className={styles.diagramCaption}>
        <span>Representative schematic · not an OEM diagram</span>
        <span>Select a numbered hotspot or use the list</span>
      </div>

      <ol className={styles.diagramList}>
        {parts.slice(0, 9).map((part, index) => (
          <li key={part.slug}>
            <Link to={hrefForPart(part.slug)}>
              <span className={styles.diagramIndex}>{String(index + 1).padStart(2, '0')}</span>
              <span>{part.name}</span>
              <ExternalLink size={11} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SvgLink({
  href,
  label,
  x,
  y,
  index,
}: {
  href: string;
  label: string;
  x: number;
  y: number;
  index: number;
}) {
  const resolvedHref = useHref(href);
  return (
    <a
      href={resolvedHref}
      className={styles.diagramNode}
      aria-label={label}
      tabIndex={0}
      role="link"
    >
      <circle cx={x} cy={y} r="17" fill="var(--bg-input)" stroke="var(--border-amber)" strokeWidth="1.5" />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fill="var(--amber)"
        fontSize="11"
        fontWeight="700"
        fontFamily="var(--font-mono)"
      >
        {index + 1}
      </text>
    </a>
  );
}
