import { useRegime } from './hooks/useRegime'
import { TopNav } from './components/TopNav'
import { SideNav } from './components/SideNav'
import { ScoreCards } from './components/ScoreCards'
import { MetricsTable } from './components/MetricsTable'
import { RegimeBreakdown } from './components/RegimeBreakdown'
import { PortfolioAllocation } from './components/PortfolioAllocation'
import { TerminalFeed } from './components/TerminalFeed'

export default function App() {
  const { data, loading, error, refetch } = useRegime()

  if (loading) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-on-surface-variant uppercase tracking-widest">Loading regime data…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <span className="material-symbols-outlined text-error text-4xl">error</span>
          <p className="text-sm text-on-surface-variant">{error ?? 'No data available'}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded hover:opacity-90 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary selection:text-on-primary min-h-screen">
      <TopNav regime={data.regime} probability={data.probability} />
      <SideNav />
      <main className="ml-0 md:ml-64 pt-20 p-6 min-h-screen grid grid-cols-12 gap-6">
        {/* Dashboard Grid Content (9 Cols) */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          <ScoreCards scores={data.scores} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricsTable title="Growth Metrics" subtitle={`UPDATED: ${data.updated_at}`} rows={data.growth_metrics} />
            <MetricsTable title="Inflation Metrics" subtitle={data.regime.toUpperCase()} rows={data.inflation_metrics} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricsTable title="Fin. Conditions" subtitle="FINANCIAL" rows={data.financial_metrics} />
            <MetricsTable title="Market Risk" subtitle="MARKET" rows={data.market_metrics} />
          </div>
        </div>

        {/* Right Sidebar (3 Cols) */}
        <aside className="col-span-12 lg:col-span-3 space-y-6">
          <RegimeBreakdown
            regime={data.regime}
            probability={data.probability}
            total_score={data.total_score}
            max_score={data.max_score}
            scores={data.scores}
          />
          <PortfolioAllocation allocation={data.allocation} regime={data.regime} />
          <TerminalFeed />
        </aside>
      </main>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={refetch}
          className="h-14 w-14 rounded-full bg-primary text-on-primary shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          title="Refresh regime data"
        >
          <span className="material-symbols-outlined">bolt</span>
        </button>
      </div>
    </div>
  )
}
