import { useMemo, useState } from 'react'

type IndicatorCard = {
  name: string
  thesis: string
  signal: string
}

type RegimeGuide = {
  regime: string
  behavior: string
  favoredAssets: string
}

type AssetExplainer = {
  asset: string
  role: string
}

type CaseStudy = {
  title: string
  context: string
  signals: string
  regime: string
  allocation: string
}

type FAQItem = {
  q: string
  a: string
}

type QuizQuestion = {
  id: string
  prompt: string
  options: string[]
  answerIndex: number
}

type VideoResource = {
  title: string
  source: string
  href: string
  note: string
}

const indicators: IndicatorCard[] = [
  { name: 'Yield Curve', thesis: 'Growth expectations and recession odds are reflected in curve shape.', signal: 'Inversion usually flags late-cycle stress and tighter financial conditions.' },
  { name: 'CPI', thesis: 'Tracks inflation pressure and policy constraints.', signal: 'Rising CPI surprises usually hurt duration and pressure risky assets.' },
  { name: 'Credit Spreads', thesis: 'Measures funding stress and default-risk pricing.', signal: 'Widening spreads indicate tightening liquidity and risk-off tone.' },
  { name: 'VIX', thesis: 'Captures implied equity volatility and fear pricing.', signal: 'Sustained high VIX often aligns with de-risking and lower beta positioning.' },
  { name: 'DXY', thesis: 'Represents global USD funding conditions and risk appetite.', signal: 'A fast DXY spike often tightens global financial conditions.' },
  { name: 'Real Rates', thesis: 'Anchors valuation pressure via inflation-adjusted yields.', signal: 'Higher real rates tend to compress growth-multiple assets.' },
  { name: 'PMI', thesis: 'Forward read on manufacturing/services cycle momentum.', signal: 'PMI below 50 and falling points to growth slowdown risk.' },
]

const playbook: RegimeGuide[] = [
  { regime: 'Risk-On', behavior: 'Breadth broadens, volatility compresses, credit conditions improve.', favoredAssets: 'Equities, cyclicals, small caps, credit beta.' },
  { regime: 'Neutral', behavior: 'Mixed cross-asset behavior with lower conviction trends.', favoredAssets: 'Balanced exposure with quality and carry.' },
  { regime: 'Risk-Off', behavior: 'Defensive leadership emerges, spreads widen, growth concern rises.', favoredAssets: 'Treasuries, quality defensives, cash buffers, gold.' },
  { regime: 'Crisis', behavior: 'Liquidity dominates fundamentals; correlations rise toward 1.', favoredAssets: 'Cash, short-duration safety, tail hedges.' },
]

const assets: AssetExplainer[] = [
  { asset: 'SPY / Broad Equities', role: 'Core growth engine when macro and market internals confirm risk-taking.' },
  { asset: 'QQQ / Growth Beta', role: 'Captures high-duration tech upside in benign-rate, risk-on windows.' },
  { asset: 'IWM / Small Caps', role: 'Adds domestic cyclical sensitivity when growth breadth improves.' },
  { asset: 'TLT / Long Duration', role: 'Defensive ballast during growth scares and disinflation shocks.' },
  { asset: 'IEF / Intermediate Treasuries', role: 'Stabilizer with less convexity risk than long duration.' },
  { asset: 'GLD / Gold', role: 'Diversifier against policy uncertainty and macro volatility.' },
  { asset: 'Cash / T-Bills', role: 'Optionality reserve during unstable transitions and high uncertainty.' },
]

const caseStudies: CaseStudy[] = [
  { title: '2008 Global Financial Crisis', context: 'Credit system stress and forced deleveraging defined the cycle.', signals: 'Credit spreads exploded, VIX surged, growth rolled over.', regime: 'Crisis', allocation: 'Heavy defensive duration/cash; minimal cyclical beta.' },
  { title: '2020 COVID Crash', context: 'Exogenous growth shock followed by extreme policy response.', signals: 'Volatility spike, PMIs collapsed, then liquidity impulse reversed conditions.', regime: 'Crisis -> Risk-On', allocation: 'Initial capital preservation, then staged re-risking as signals normalized.' },
  { title: '2022 Inflation Shock', context: 'Persistent inflation forced aggressive central bank tightening.', signals: 'CPI remained elevated, real rates rose sharply, duration repriced.', regime: 'Risk-Off', allocation: 'Reduced long-duration growth; favored defensives, commodities, and cash discipline.' },
]

const faqs: FAQItem[] = [
  { q: 'Is this market timing?', a: 'It is a regime process, not single-point timing. The goal is to adjust risk as probabilities change.' },
  { q: 'How often does regime update?', a: 'Signals refresh as data updates. You should focus on trend persistence over one-day noise.' },
  { q: 'Can allocations change quickly?', a: 'Yes, during stress transitions the model can de-risk faster than during stable regimes.' },
  { q: 'Why not hold one static portfolio?', a: 'Static portfolios can underperform when macro conditions structurally shift for long periods.' },
]

const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'What does a sharp widening in credit spreads most often indicate?',
    options: ['Improving liquidity', 'Rising risk stress', 'Lower volatility certainty', 'Fed easing already complete'],
    answerIndex: 1,
  },
  {
    id: 'q2',
    prompt: 'In Risk-Off, which allocation tilt is generally favored?',
    options: ['Higher small-cap beta', 'More defensive duration and quality', 'Concentrated crypto risk', 'Maximum leverage'],
    answerIndex: 1,
  },
  {
    id: 'q3',
    prompt: 'A rapid rise in real rates typically pressures which assets most?',
    options: ['Long-duration growth assets', 'Cash equivalents', 'Short-term T-bills', 'Defensive utilities'],
    answerIndex: 0,
  },
]

const videoResources: VideoResource[] = [
  {
    title: 'Ray Dalio: How the Economic Machine Works',
    source: 'YouTube',
    href: 'https://www.youtube.com/watch?v=PHe0bXAIuk0',
    note: 'Foundational macro cycle framework for growth, debt, and policy.',
  },
  {
    title: 'FOMC Press Conference (Latest Archive)',
    source: 'Federal Reserve',
    href: 'https://www.federalreserve.gov/monetarypolicy/fomcpresconf.htm',
    note: 'Primary source for policy tone and forward-guidance shifts.',
  },
  {
    title: 'Financial Conditions and Market Risk',
    source: 'CFA Institute',
    href: 'https://www.cfainstitute.org/en/research',
    note: 'Research library for risk regime thinking and portfolio implications.',
  },
  {
    title: 'IMF World Economic Outlook',
    source: 'IMF',
    href: 'https://www.imf.org/en/Publications/WEO',
    note: 'Global growth/inflation context for cross-country regime analysis.',
  },
]

function randomId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `RIQ-${stamp}-${rand}`
}

function sandboxRegime(cpi: number, vix: number, dxy: number): { regime: string; note: string } {
  let score = 0
  if (cpi > 6) score += 2
  else if (cpi > 4) score += 1

  if (vix > 28) score += 2
  else if (vix > 20) score += 1

  if (dxy > 106) score += 2
  else if (dxy > 102) score += 1

  if (score >= 5) return { regime: 'Crisis', note: 'Extreme cross-asset stress profile.' }
  if (score >= 3) return { regime: 'Risk-Off', note: 'Defensive posture is generally favored.' }
  if (score >= 1) return { regime: 'Neutral', note: 'Mixed data calls for balanced positioning.' }
  return { regime: 'Risk-On', note: 'Conditions suggest constructive risk appetite.' }
}

export function LearnTab() {
  const [expanded, setExpanded] = useState<string | null>(indicators[0].name)
  const [cpi, setCpi] = useState(3.2)
  const [vix, setVix] = useState(17)
  const [dxy, setDxy] = useState(101)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [certificateId, setCertificateId] = useState<string>('')

  const sandbox = useMemo(() => sandboxRegime(cpi, vix, dxy), [cpi, vix, dxy])

  const quizScore = useMemo(() => {
    let score = 0
    quizQuestions.forEach((q) => {
      if (answers[q.id] === q.answerIndex) score += 1
    })
    return score
  }, [answers])

  const quizPassed = quizScore >= 2
  const panelClass = 'bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm'
  const softCardClass = 'rounded-lg border border-outline-variant/20 bg-surface-container-high/40'

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <section className={`rounded-2xl border border-outline-variant/20 bg-gradient-to-r from-[#c6ff1f]/10 via-surface-container to-surface-container p-6 shadow-[0_18px_44px_rgba(0,0,0,0.32)]`}>
        <div className="text-xs uppercase tracking-[0.16em] text-on-surface-variant mb-2">Research Education Layer</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Macro Intelligence Academy</h1>
        <p className="mt-3 text-sm text-on-surface-variant max-w-3xl">
          Institutional-grade education layer for understanding macro indicators, regime transitions, and portfolio logic.
        </p>
      </section>

      <section className={panelClass}>
        <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Video Briefings</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videoResources.map((video) => (
            <a
              key={video.title}
              href={video.href}
              target="_blank"
              rel="noreferrer"
              className={`${softCardClass} px-4 py-3 transition-all duration-200 hover:bg-surface-container-high`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold">{video.title}</div>
                <span className="material-symbols-outlined text-sm text-on-surface-variant">open_in_new</span>
              </div>
              <div className="mt-1 text-[11px] text-on-surface-variant">{video.source}</div>
              <div className="mt-2 text-xs text-on-surface-variant">{video.note}</div>
            </a>
          ))}
        </div>
      </section>

      <section className={panelClass}>
        <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Macro Indicator Library</div>
        <div className="space-y-3">
          {indicators.map((item) => {
            const open = expanded === item.name
            return (
              <div key={item.name} className={`${softCardClass} overflow-hidden`}>
                <button
                  className="w-full text-left px-4 py-3 flex items-center justify-between"
                  onClick={() => setExpanded(open ? null : item.name)}
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="material-symbols-outlined text-on-surface-variant">{open ? 'expand_less' : 'expand_more'}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 text-sm space-y-2 text-on-surface-variant">
                    <p>{item.thesis}</p>
                    <p className="text-on-surface">Signal read: {item.signal}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={panelClass}>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Regime Playbook Explainer</div>
          <div className="space-y-3">
            {playbook.map((entry) => (
              <div
                key={entry.regime}
                className={`${softCardClass} px-4 py-3`}
                style={{
                  borderColor:
                    entry.regime === 'Risk-On'
                      ? 'rgba(34,197,94,0.45)'
                      : entry.regime === 'Neutral'
                        ? 'rgba(245,158,11,0.45)'
                        : entry.regime === 'Risk-Off'
                          ? 'rgba(249,115,22,0.45)'
                          : 'rgba(239,68,68,0.45)',
                }}
              >
                <div className="font-semibold flex items-center gap-2">
                  <span>{entry.regime}</span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background:
                        entry.regime === 'Risk-On'
                          ? '#22c55e'
                          : entry.regime === 'Neutral'
                            ? '#f59e0b'
                            : entry.regime === 'Risk-Off'
                              ? '#f97316'
                              : '#ef4444',
                    }}
                  />
                </div>
                <div className="text-xs text-on-surface-variant mt-1">{entry.behavior}</div>
                <div className="text-xs mt-2">Favored assets: {entry.favoredAssets}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={panelClass}>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Portfolio Asset Explainer</div>
          <div className="space-y-3">
            {assets.map((item) => (
              <div key={item.asset} className={`${softCardClass} px-4 py-3`}>
                <div className="font-semibold">{item.asset}</div>
                <div className="text-xs text-on-surface-variant mt-1">{item.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={panelClass}>
        <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Historical Case Studies</div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {caseStudies.map((study) => (
            <div
              key={study.title}
              className={`${softCardClass} px-4 py-3 space-y-2`}
              style={{
                borderColor:
                  study.regime.includes('Risk-On')
                    ? 'rgba(34,197,94,0.45)'
                    : study.regime.includes('Risk-Off')
                      ? 'rgba(249,115,22,0.45)'
                      : 'rgba(239,68,68,0.45)',
              }}
            >
              <div className="font-semibold">{study.title}</div>
              <p className="text-xs text-on-surface-variant">{study.context}</p>
              <p className="text-xs">Signals: {study.signals}</p>
              <p className="text-xs">Regime: {study.regime}</p>
              <p className="text-xs">Allocation bias: {study.allocation}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={panelClass}>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">FAQ</div>
          <div className="space-y-3">
            {faqs.map((item) => (
              <details key={item.q} className={`${softCardClass} px-4 py-3`}>
                <summary className="cursor-pointer font-semibold">{item.q}</summary>
                <p className="text-xs text-on-surface-variant mt-2">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className={panelClass}>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Signal Sandbox (Optional)</div>
          <div className="space-y-4">
            <label className="block">
              <div className="flex justify-between text-xs mb-1"><span>CPI (%)</span><span>{cpi.toFixed(1)}</span></div>
              <input type="range" min={1} max={10} step={0.1} value={cpi} onChange={(e) => setCpi(Number(e.target.value))} className="w-full" />
            </label>
            <label className="block">
              <div className="flex justify-between text-xs mb-1"><span>VIX</span><span>{vix.toFixed(0)}</span></div>
              <input type="range" min={10} max={50} step={1} value={vix} onChange={(e) => setVix(Number(e.target.value))} className="w-full" />
            </label>
            <label className="block">
              <div className="flex justify-between text-xs mb-1"><span>DXY</span><span>{dxy.toFixed(0)}</span></div>
              <input type="range" min={95} max={115} step={1} value={dxy} onChange={(e) => setDxy(Number(e.target.value))} className="w-full" />
            </label>
            <div className="rounded-lg border border-primary/25 bg-primary/10 px-4 py-3">
              <div className="text-xs text-on-surface-variant">Implied regime</div>
              <div className="text-lg font-black mt-1">{sandbox.regime}</div>
              <div className="text-xs text-on-surface-variant mt-1">{sandbox.note}</div>
            </div>
          </div>
        </div>
      </section>

      <section className={panelClass}>
        <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Quiz + Certificate</div>
        <div className="space-y-4">
          {quizQuestions.map((q, index) => (
            <div key={q.id} className={`${softCardClass} px-4 py-3`}>
              <div className="text-sm font-semibold">{index + 1}. {q.prompt}</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {q.options.map((option, optionIndex) => {
                  const selected = answers[q.id] === optionIndex
                  return (
                    <button
                      key={option}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optionIndex }))}
                      className={`text-left rounded-lg px-3 py-2 text-xs border transition-all ${
                        selected ? 'border-primary bg-primary/20 text-on-surface' : 'border-outline-variant/20 bg-surface-container'
                      }`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="text-sm">Score: <span className="font-bold">{quizScore}/{quizQuestions.length}</span></div>
          <button
            onClick={() => setCertificateId(randomId())}
            disabled={!quizPassed}
            className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Certificate ID
          </button>
          <button
            onClick={() => {
              setAnswers({})
              setCertificateId('')
            }}
            className="px-4 py-2 rounded border border-outline-variant/20 text-xs"
          >
            Reset Quiz
          </button>
        </div>
        <div className="mt-2 text-xs text-on-surface-variant">
          Pass threshold: 2/3 correct. Certificate is issued client-side only, no backend dependency.
        </div>
        {certificateId && (
          <div className="mt-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
            <div className="text-xs uppercase tracking-widest text-on-surface-variant">Certificate Issued</div>
            <div className="text-sm font-bold mt-1">{certificateId}</div>
          </div>
        )}
      </section>

    </section>
  )
}
