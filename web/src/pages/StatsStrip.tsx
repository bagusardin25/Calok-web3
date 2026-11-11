import { fetchStats } from '../lib/contract'
import { useAsync } from '../lib/useAsync'

/** Live counts read from the contract (PRD F9). */
export function StatsStrip() {
  const stats = useAsync('stats', fetchStats)
  const s = stats.data
  const items = [
    { label: 'Spots', value: s?.spots },
    { label: 'Ever verified', value: s?.verified },
    { label: 'Confirmations', value: s?.confirmations },
    { label: 'Mappers', value: s?.mappers },
  ]
  if (stats.error) return null
  return (
    <dl className="stats" aria-label="Colok in numbers">
      {items.map((item) => (
        <div key={item.label} className="stats__item">
          <dt>{item.label}</dt>
          <dd className="mono">{item.value === undefined ? '–' : item.value.toLocaleString('en-GB')}</dd>
        </div>
      ))}
    </dl>
  )
}
