import {
  Activity,
  Gauge,
  LineChart,
  Menu,
  Monitor,
  Moon,
  PauseCircle,
  RotateCcw,
  Settings,
  Sun,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react"
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react"
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom"
import { Toaster, toast } from "sonner"
import {
  QueryClient,
  QueryClientProvider,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query"

import { useTheme } from "@/components/theme-provider"

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

type ScreenId =
  | "dashboard"
  | "prealerts"
  | "alerta"
  | "gainers"
  | "losers"
  | "halts"
  | "bidask"
  | "configuration"

type MoverKind = "gainers" | "losers"

type MoverRow = {
  symbol: string
  name?: string
  lastSalePrice: string
  lastSaleChange: string
  change: string
}

type StocktwitsItem = {
  symbol: string
  rank: number
  trending_score?: number
  watchlist_count?: number
  fundamentals?: {
    FloatCurrent?: string | number
    AverageDailyVolumeLastMonth?: string | number
  }
  price_data?: {
    Last?: number
    PercentChange?: number
    Volume?: number
    High?: number
  }
}

type AlertRow = {
  symbol: string
  last: number
  changePct: number
  rvol: number
  volume: number
  floatValue?: number
  hodPct?: number
  yvol?: number
  stRank?: number
  stScore?: number
  mode: "PREALERTA" | "ALERTA"
}

type HaltRow = {
  symbol: string
  name: string
  market: string
  reason: string
  haltDate: string
  haltTime: string
  resumeTime: string
}

type BidAskSnapshot = {
  time: string
  price: number
  diffPct?: number
  status: "PRIMER" | "SUBE" | "BAJA" | "ESTABLE"
  volume: number
  volumeChangePct?: number
  forceIndex?: number
}

type BidAskMonitorState = {
  id: number
  draftSymbol: string
  draftReference: string
  symbol: string
  reference?: number
  refreshSeconds: number
  isRunning: boolean
  history: BidAskSnapshot[]
}

type AppearedRow = {
  symbol: string
  name?: string
  lastSalePrice: string
  change: string
  time: string
}

type RequestLog = {
  id: string
  source: string
  status: "OK" | "ERROR"
  message: string
  time: string
}

type Screen = {
  id: ScreenId
  label: string
  description: string
  icon: typeof Gauge
  path: string
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const marketMoversUrl = "/nasdaq/api/marketmovers?assetclass=stocks&market=NASDAQ"
const stocktwitsUrl =
  "/stocktwits/api/2/trending/most_active.json?class=all&limit=100&page_num=1&payloads=qprices"
const haltsUrl = "/halts/rss.aspx?feed=tradehalts"
const haltsPageUrl = "/halts/Trader.aspx?id=TradeHalts"
const adsenseClient = "ca-pub-7088196909984917"
const defaultAdsenseSlot = (import.meta.env.VITE_ADSENSE_SLOT_DEFAULT as string | undefined) || "1674078274"
const adsenseSlots: Partial<Record<string, string | undefined>> = {
  "dashboard-top": import.meta.env.VITE_ADSENSE_SLOT_DASHBOARD_TOP,
  "dashboard-in-feed": import.meta.env.VITE_ADSENSE_SLOT_DASHBOARD_IN_FEED,
  "gainers-top": import.meta.env.VITE_ADSENSE_SLOT_GAINERS_TOP,
  "gainers-bottom": import.meta.env.VITE_ADSENSE_SLOT_GAINERS_BOTTOM,
  "losers-top": import.meta.env.VITE_ADSENSE_SLOT_LOSERS_TOP,
  "losers-bottom": import.meta.env.VITE_ADSENSE_SLOT_LOSERS_BOTTOM,
  "pre-alerts-top": import.meta.env.VITE_ADSENSE_SLOT_PRE_ALERTS_TOP,
  "pre-alerts-bottom": import.meta.env.VITE_ADSENSE_SLOT_PRE_ALERTS_BOTTOM,
  "alerts-runner-top": import.meta.env.VITE_ADSENSE_SLOT_ALERTS_RUNNER_TOP,
  "alerts-runner-bottom": import.meta.env.VITE_ADSENSE_SLOT_ALERTS_RUNNER_BOTTOM,
  "halts-top": import.meta.env.VITE_ADSENSE_SLOT_HALTS_TOP,
  "halts-bottom": import.meta.env.VITE_ADSENSE_SLOT_HALTS_BOTTOM,
  "bid-ask-top": import.meta.env.VITE_ADSENSE_SLOT_BID_ASK_TOP,
  "bid-ask-bottom": import.meta.env.VITE_ADSENSE_SLOT_BID_ASK_BOTTOM,
  "configuration-top": import.meta.env.VITE_ADSENSE_SLOT_CONFIGURATION_TOP,
  "configuration-bottom": import.meta.env.VITE_ADSENSE_SLOT_CONFIGURATION_BOTTOM,
  "stock-top": import.meta.env.VITE_ADSENSE_SLOT_STOCK_TOP,
  "stock-bottom": import.meta.env.VITE_ADSENSE_SLOT_STOCK_BOTTOM,
}

const screens: Screen[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Command center for scanners, halts, and active monitoring.",
    icon: Gauge,
    path: "/",
  },
  {
    id: "prealerts",
    label: "Pre-Alerts",
    description: "Early signals before a confirmed runner.",
    icon: Zap,
    path: "/pre-alerts",
  },
  {
    id: "alerta",
    label: "Alerts-Runner",
    description: "Confirmed runners filtered by price, volume, RVOL, and breakout behavior.",
    icon: Activity,
    path: "/alerts-runner",
  },
  {
    id: "gainers",
    label: "Nasdaq Gain",
    description: "Top NASDAQ stocks with the strongest upside moves.",
    icon: TrendingUp,
    path: "/gainers",
  },
  {
    id: "losers",
    label: "Nasdaq Losers",
    description: "Top NASDAQ stocks with the sharpest downside moves.",
    icon: TrendingDown,
    path: "/losers",
  },
  {
    id: "halts",
    label: "Halts",
    description: "Trading halts from Nasdaq Trader.",
    icon: PauseCircle,
    path: "/halts",
  },
  {
    id: "bidask",
    label: "Bid/Ask Monitor",
    description: "Ten independent ticker monitors with per-tab timers.",
    icon: Monitor,
    path: "/bid-ask",
  },
  {
    id: "configuration",
    label: "Configuration",
    description: "Theme, notifications, global refresh, and request diagnostics.",
    icon: Settings,
    path: "/configuration",
  },
]

const initialBidAskMonitors: BidAskMonitorState[] = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  draftSymbol: index === 0 ? "SCAG" : "",
  draftReference: "",
  symbol: index === 0 ? "SCAG" : "",
  refreshSeconds: 3,
  isRunning: false,
  history: [],
}))

function getScreenIdFromPath(pathname: string): ScreenId {
  return screens.find((screen) => screen.path === pathname)?.id ?? "dashboard"
}

function getTickerFromStockPath(pathname: string) {
  const match = pathname.match(/^\/stock\/([^/?#]+)/i)
  return match ? normalizeTicker(decodeURIComponent(match[1])) : ""
}

function normalizeTicker(value?: string) {
  return (value ?? "").replace(/[^a-z0-9.-]/gi, "").toUpperCase()
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NotificationToaster />
        <RocketScreeners />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function NotificationToaster() {
  const { theme } = useTheme()

  return <Toaster richColors closeButton position="bottom-right" theme={theme === "system" ? "system" : theme} />
}

function RocketScreeners() {
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [refreshSeconds, setRefreshSeconds] = useLocalStorage("rocket.refreshSeconds", 10)
  const [sonnerNotificationsEnabled, setSonnerNotificationsEnabled] = useLocalStorage("rocket.sonnerNotifications", true)
  const [systemNotificationsEnabled, setSystemNotificationsEnabled] = useLocalStorage("rocket.systemNotifications", false)
  const [eventCounts, setEventCounts] = useState<Partial<Record<ScreenId, number>>>({})
  const [requestLogs, setRequestLogs] = useLocalStorage<RequestLog[]>("rocket.requestLogs", [])
  const [bidAskMonitors, setBidAskMonitors] = useLocalStorage<BidAskMonitorState[]>(
    "rocket.bidAskMonitors",
    initialBidAskMonitors,
  )
  const [activeBidAskTab, setActiveBidAskTab] = useLocalStorage("rocket.activeBidAskTab", 1)
  const [preAlertHistory, setPreAlertHistory] = useLocalStorage<AppearedRow[]>("rocket.preAlertHistory", [])
  const [runnerAlertHistory, setRunnerAlertHistory] = useLocalStorage<AppearedRow[]>(
    "rocket.runnerAlertHistory",
    [],
  )

  const activeScreen = getScreenIdFromPath(location.pathname)
  const routeTicker = getTickerFromStockPath(location.pathname)
  const active = routeTicker
    ? {
        label: `${routeTicker} Stock Monitor`,
        description: "Dedicated bid/ask-style tracking for this ticker.",
      }
    : (screens.find((screen) => screen.id === activeScreen) ?? screens[0])
  const gainers = useMovers("gainers", refreshSeconds)
  const losers = useMovers("losers", refreshSeconds)
  const alerts = useAlerts(refreshSeconds)
  const halts = useHalts(refreshSeconds)
  const preAlertRows = useMemo(
    () => alerts.data?.filter((row) => row.mode === "PREALERTA") ?? [],
    [alerts.data],
  )
  const runnerAlertRows = useMemo(
    () => alerts.data?.filter((row) => row.mode === "ALERTA") ?? [],
    [alerts.data],
  )
  const runningBidAskCount = bidAskMonitors.filter((monitor) => monitor.isRunning).length

  useQueryLogger("Gainers", gainers, setRequestLogs)
  useQueryLogger("Losers", losers, setRequestLogs)
  useQueryLogger("Alerts", alerts, setRequestLogs)
  useQueryLogger("Halts", halts, setRequestLogs)
  useAlertHistory(preAlertRows, setPreAlertHistory)
  useAlertHistory(runnerAlertRows, setRunnerAlertHistory)

  useNewRowsNotification({
    getKey: (row) => row.symbol,
    getMessage: (row) => `${row.symbol} entered Gainers: ${row.change} | Price ${row.lastSalePrice}`,
    rows: gainers.data,
    screen: "gainers",
    setEventCounts,
    sonnerEnabled: sonnerNotificationsEnabled,
    systemEnabled: systemNotificationsEnabled,
  })
  useNewRowsNotification({
    getKey: (row) => row.symbol,
    getMessage: (row) => `${row.symbol} entered Losers: ${row.change} | Price ${row.lastSalePrice}`,
    rows: losers.data,
    screen: "losers",
    setEventCounts,
    sonnerEnabled: sonnerNotificationsEnabled,
    systemEnabled: systemNotificationsEnabled,
  })
  useNewRowsNotification({
    getKey: (row) => `${row.mode}-${row.symbol}`,
    getMessage: (row) => `${formatAlertMode(row.mode)}: ${row.symbol} ${row.changePct.toFixed(1)}% | Price $${row.last.toFixed(2)}`,
    rows: preAlertRows,
    screen: "prealerts",
    setEventCounts,
    sonnerEnabled: sonnerNotificationsEnabled,
    systemEnabled: systemNotificationsEnabled,
  })
  useNewRowsNotification({
    getKey: (row) => `${row.mode}-${row.symbol}`,
    getMessage: (row) => `${formatAlertMode(row.mode)}: ${row.symbol} ${row.changePct.toFixed(1)}% | Price $${row.last.toFixed(2)}`,
    rows: runnerAlertRows,
    screen: "alerta",
    setEventCounts,
    sonnerEnabled: sonnerNotificationsEnabled,
    systemEnabled: systemNotificationsEnabled,
  })
  useNewRowsNotification({
    getKey: (row) => `${row.symbol}-${row.haltDate}-${row.haltTime}-${row.reason}`,
    getMessage: (row) => `Halt ${row.symbol}: ${row.reason} ${row.haltTime}`,
    rows: halts.data,
    screen: "halts",
    setEventCounts,
    sonnerEnabled: sonnerNotificationsEnabled,
    systemEnabled: systemNotificationsEnabled,
  })

  return (
    <main className="app-shell">
      {bidAskMonitors.map((monitor) => (
        <BidAskMonitorRuntime
          key={monitor.id}
          monitor={monitor}
          setEventCounts={setEventCounts}
          setLogs={setRequestLogs}
          setMonitors={setBidAskMonitors}
          sonnerNotificationsEnabled={sonnerNotificationsEnabled}
          systemNotificationsEnabled={systemNotificationsEnabled}
        />
      ))}

      <SidebarContent
        activeScreen={activeScreen}
        eventCounts={eventCounts}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        refreshSeconds={refreshSeconds}
        runningBidAskCount={runningBidAskCount}
        setEventCounts={setEventCounts}
      />

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Rocket web terminal</span>
            <h1>{active.label}</h1>
            <p>{active.description}</p>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-action mobile-menu-trigger"
              onClick={() => setIsMobileMenuOpen(true)}
              title="Open menu"
              type="button"
            >
              <Menu size={18} />
            </button>
            <button
              className="icon-action"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
              type="button"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              className="icon-action"
              onClick={() => {
                void queryClient.invalidateQueries()
                toast.success("Refresh requested", { description: "All active queries are being refreshed." })
              }}
              title="Refresh now"
              type="button"
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </header>

        <Routes>
          <Route
            element={
              <Dashboard
                alerts={alerts}
                gainers={gainers}
                halts={halts}
                losers={losers}
                preAlertRows={preAlertRows}
                refreshSeconds={refreshSeconds}
                runnerAlertRows={runnerAlertRows}
              />
            }
            path="/"
          />
          <Route
            element={
              <AlertRowsScreen
                history={preAlertHistory}
                mode="PREALERTA"
                query={alerts}
                setHistory={setPreAlertHistory}
              />
            }
            path="/pre-alerts"
          />
          <Route
            element={
              <AlertRowsScreen
                history={runnerAlertHistory}
                mode="ALERTA"
                query={alerts}
                setHistory={setRunnerAlertHistory}
              />
            }
            path="/alerts-runner"
          />
          <Route element={<MoversScreen kind="gainers" query={gainers} />} path="/gainers" />
          <Route element={<MoversScreen kind="losers" query={losers} />} path="/losers" />
          <Route element={<HaltsScreen query={halts} />} path="/halts" />
          <Route
            element={
              <BidAskScreen
                activeTab={activeBidAskTab}
                monitors={bidAskMonitors}
                setActiveTab={setActiveBidAskTab}
                setMonitors={setBidAskMonitors}
              />
            }
            path="/bid-ask"
          />
          <Route
            element={
              <StockMonitorRoute
                setLogs={setRequestLogs}
                sonnerNotificationsEnabled={sonnerNotificationsEnabled}
                systemNotificationsEnabled={systemNotificationsEnabled}
              />
            }
            path="/stock/:ticker"
          />
          <Route
            element={
              <ConfigurationScreen
                logs={requestLogs}
                refreshSeconds={refreshSeconds}
                setLogs={setRequestLogs}
                setRefreshSeconds={setRefreshSeconds}
                setSonnerNotificationsEnabled={setSonnerNotificationsEnabled}
                setSystemNotificationsEnabled={setSystemNotificationsEnabled}
                sonnerNotificationsEnabled={sonnerNotificationsEnabled}
                systemNotificationsEnabled={systemNotificationsEnabled}
                setTheme={setTheme}
                theme={theme}
              />
            }
            path="/configuration"
          />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </section>
    </main>
  )
}

function SidebarContent({
  activeScreen,
  eventCounts,
  isMobileMenuOpen,
  onCloseMobileMenu,
  refreshSeconds,
  runningBidAskCount,
  setEventCounts,
}: {
  activeScreen: ScreenId
  eventCounts: Partial<Record<ScreenId, number>>
  isMobileMenuOpen: boolean
  onCloseMobileMenu: () => void
  refreshSeconds: number
  runningBidAskCount: number
  setEventCounts: Dispatch<SetStateAction<Partial<Record<ScreenId, number>>>>
}) {
  const sidebar = (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <LineChart size={21} />
        </div>
        <div>
          <strong>Rocket Screeners</strong>
          <span>Professional web desk</span>
        </div>
      </div>

      <nav className="menu" aria-label="Screens">
        {screens.map((screen) => {
          const Icon = screen.icon
          return (
            <NavLink
              className={({ isActive }) => `menu-item ${isActive || screen.id === activeScreen ? "active" : ""}`}
              end={screen.path === "/"}
              key={screen.id}
              onClick={() => {
                setEventCounts((current) => ({ ...current, [screen.id]: 0 }))
                onCloseMobileMenu()
              }}
              to={screen.path}
            >
              <Icon size={17} />
              <span>{screen.label}</span>
              {!!eventCounts[screen.id] && <b>{eventCounts[screen.id]}</b>}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="live-dot" />
        <div>
          <strong>Live polling</strong>
          <span>{refreshSeconds}s global | Bid/Ask active: {runningBidAskCount}</span>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      <div className="desktop-sidebar">{sidebar}</div>
      <div className={`mobile-drawer ${isMobileMenuOpen ? "open" : ""}`} aria-hidden={!isMobileMenuOpen}>
        <button className="drawer-backdrop" onClick={onCloseMobileMenu} type="button" />
        <div className="drawer-panel">
          <div className="drawer-header">
            <span>Navigation</span>
            <button className="icon-action" onClick={onCloseMobileMenu} title="Close menu" type="button">
              <X size={18} />
            </button>
          </div>
          {sidebar}
        </div>
      </div>
    </>
  )
}

function Dashboard({
  alerts,
  gainers,
  halts,
  losers,
  preAlertRows,
  refreshSeconds,
  runnerAlertRows,
}: {
  alerts: UseQueryResult<AlertRow[], Error>
  gainers: UseQueryResult<MoverRow[], Error>
  halts: UseQueryResult<HaltRow[], Error>
  losers: UseQueryResult<MoverRow[], Error>
  preAlertRows: AlertRow[]
  refreshSeconds: number
  runnerAlertRows: AlertRow[]
}) {
  return (
    <div className="dashboard-grid">
      <MetricCard label="Pre-Alerts" note="Early breakout watch" tone="violet" value={preAlertRows.length} />
      <MetricCard label="Alerts-Runner" note="RVOL + HOD" tone="cyan" value={runnerAlertRows.length} />
      <MetricCard label="Gainers" note="Nasdaq top 10" tone="green" value={gainers.data?.length ?? 0} />
      <MetricCard label="Halts" note="Nasdaq Trader" tone="amber" value={halts.data?.length ?? 0} />

      <AdSlot format="leaderboard" label="Top dashboard ad" placement="dashboard-top" />

      <section className="panel hero-panel">
        <div>
          <span className="eyebrow">System status</span>
          <h2>Live monitoring every {refreshSeconds}s</h2>
          <p>
            General scanners run in parallel with TanStack React Query. Recent events and preferences are
            persisted locally so the desk keeps its working context after a reload.
          </p>
        </div>
        <div className="health-list">
          <HealthItem label="Gainers" query={gainers} />
          <HealthItem label="Losers" query={losers} />
          <HealthItem label="Alerts" query={alerts} />
          <HealthItem label="Halts" query={halts} />
        </div>
      </section>

      <section className="panel">
        <PanelTitle title="Active Alert Stream" subtitle="Pre-alerts and confirmed runners." />
        <MiniList rows={alerts.data?.slice(0, 8).map((row) => ({
          symbol: row.symbol,
          meta: `${formatAlertMode(row.mode)} ${row.changePct.toFixed(1)}% @ $${row.last.toFixed(2)}`,
        }))} />
      </section>

      <section className="panel">
        <PanelTitle title="Recent Halts" subtitle="Latest events from Nasdaq Trader." />
        <MiniList rows={halts.data?.slice(0, 8).map((row) => ({
          symbol: row.symbol,
          meta: `${row.reason} ${row.haltTime}`,
        }))} />
      </section>

      <AdSlot format="rectangle" label="In-feed dashboard ad" placement="dashboard-in-feed" />

      <section className="panel">
        <PanelTitle title="Top Momentum" subtitle="Fast read of the strongest current gainers." />
        <MiniList rows={gainers.data?.slice(0, 8).map((row) => ({
          symbol: row.symbol,
          meta: `${row.change} @ ${row.lastSalePrice}`,
        }))} />
      </section>

      <section className="panel">
        <PanelTitle title="Risk Watch" subtitle="Downside movers that may need attention." />
        <MiniList rows={losers.data?.slice(0, 8).map((row) => ({
          symbol: row.symbol,
          meta: `${row.change} @ ${row.lastSalePrice}`,
        }))} />
      </section>
    </div>
  )
}

function MetricCard({
  label,
  note,
  tone,
  value,
}: {
  label: string
  note: string
  tone: string
  value: number
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

function AdSlot({
  format,
  label,
  placement,
}: {
  format: "leaderboard" | "rectangle" | "skyscraper"
  label: string
  placement: string
}) {
  const slotId = adsenseSlots[placement] || defaultAdsenseSlot

  useEffect(() => {
    if (!slotId) {
      return
    }

    try {
      window.adsbygoogle = window.adsbygoogle ?? []
      window.adsbygoogle.push({})
    } catch {
      // AdSense can throw when the slot is already filled during route transitions.
    }
  }, [placement, slotId])

  return (
    <aside aria-label={label} className={`ad-slot ${format}`} data-ad-placement={placement}>
      <span className="ad-slot-label">Advertisement</span>
      {slotId ? (
        <>
          <ins
            className="adsbygoogle"
            data-ad-client={adsenseClient}
            data-ad-format="auto"
            data-ad-slot={slotId}
            data-full-width-responsive="true"
            style={{ display: "block" }}
          />
          <small className="ad-slot-placeholder">Ad space reserved</small>
        </>
      ) : (
        <>
          <strong>Google AdSense</strong>
          <small>{placement}: ad slot id not configured</small>
        </>
      )}
    </aside>
  )
}

function HealthItem({ label, query }: { label: string; query: UseQueryResult<unknown, Error> }) {
  const status = query.isError ? "ERROR" : query.isFetching ? "SYNC" : "OK"
  return (
    <div className="health-item">
      <span>{label}</span>
      <b className={status.toLowerCase()}>{status}</b>
    </div>
  )
}

function MoversScreen({ kind, query }: { kind: MoverKind; query: UseQueryResult<MoverRow[], Error> }) {
  const previousSymbolsRef = useRef<Set<string> | null>(null)
  const [appearedRows, setAppearedRows] = useLocalStorage<AppearedRow[]>(`rocket.${kind}.appeared`, [])

  useEffect(() => {
    if (!query.data?.length) {
      return
    }

    const currentSymbols = new Set(query.data.map((row) => row.symbol))
    const previousSymbols = previousSymbolsRef.current
    if (previousSymbols) {
      const newRows = query.data
        .filter((row) => !previousSymbols.has(row.symbol))
        .map((row) => ({
          symbol: row.symbol,
          name: row.name,
          lastSalePrice: row.lastSalePrice,
          change: row.change,
          time: new Date().toLocaleString(),
        }))

      if (newRows.length) {
        setAppearedRows((current) => [...newRows, ...current].slice(0, 200))
      }
    }

    previousSymbolsRef.current = currentSymbols
  }, [query.data, setAppearedRows])

  return (
    <div className="route-stack">
      <AdSlot format="leaderboard" label={`${kind} top ad`} placement={`${kind}-top`} />
      <div className="split-screen">
        <section className="panel">
          <PanelTitle
            title={kind === "gainers" ? "Current Gainers" : "Current Losers"}
            subtitle="Live list from the latest refresh."
          />
          <ScreenStatus error={query.error} isLoading={query.isLoading} />
          <div className="data-table movers-table">
            <div className="table-head">
              <span>Ticker</span>
              <span>Last</span>
              <span>Change</span>
              <span>%</span>
              <span>Name</span>
            </div>
            <div className="table-body">
              {query.data?.map((row) => (
                <div className="table-row" key={row.symbol}>
                  <strong>{row.symbol}</strong>
                  <span>{row.lastSalePrice}</span>
                  <span>{row.lastSaleChange}</span>
                  <span className={kind === "gainers" ? "positive" : "negative"}>{row.change}</span>
                  <span>{row.name}</span>
                </div>
              ))}
              {!query.data?.length && <EmptyInline text="No data yet." />}
            </div>
          </div>
        </section>

        <section className="panel">
          <PanelTitle
            action={
              <button className="ghost-action small" onClick={() => setAppearedRows([])} type="button">
                Clear
              </button>
            }
            title="New Arrivals"
            subtitle="Detected by comparing against the previous refresh."
          />
          <div className="data-table appeared-table">
            <div className="table-head">
              <span>Date/Time</span>
              <span>Ticker</span>
              <span>Last</span>
              <span>%</span>
            </div>
            <div className="table-body">
              {appearedRows.map((row, index) => (
                <div className="table-row" key={`${row.symbol}-${row.time}-${index}`}>
                  <span>{row.time}</span>
                  <strong>{row.symbol}</strong>
                  <span>{row.lastSalePrice}</span>
                  <span className={kind === "gainers" ? "positive" : "negative"}>{row.change}</span>
                </div>
              ))}
              {!appearedRows.length && <EmptyInline text="No new tickers yet." />}
            </div>
          </div>
        </section>
      </div>
      <AdSlot format="rectangle" label={`${kind} bottom ad`} placement={`${kind}-bottom`} />
    </div>
  )
}

function AlertRowsScreen({
  history,
  mode,
  query,
  setHistory,
}: {
  history: AppearedRow[]
  mode: AlertRow["mode"]
  query: UseQueryResult<AlertRow[], Error>
  setHistory: Dispatch<SetStateAction<AppearedRow[]>>
}) {
  const rows = query.data?.filter((row) => row.mode === mode) ?? []
  const routeKey = mode === "PREALERTA" ? "pre-alerts" : "alerts-runner"

  return (
    <div className="route-stack">
      <AdSlot format="leaderboard" label={`${routeKey} top ad`} placement={`${routeKey}-top`} />
      <div className="split-screen">
        <section className="panel">
          <PanelTitle
            title={mode === "PREALERTA" ? "Active Pre-Alerts" : "Active Runner Alerts"}
            subtitle={
              mode === "PREALERTA"
                ? "Early signals with extreme 2m volume."
                : "Confirmed runners near the high-of-day."
            }
          />
          <ScreenStatus error={query.error} isLoading={query.isLoading} />
          <div className="data-table alerta-table">
            <div className="table-head">
              <span>Mode</span>
              <span>Ticker</span>
              <span>Price</span>
              <span>%</span>
              <span>RVOL</span>
              <span>Vol</span>
              <span>Float</span>
              <span>YVol</span>
              <span>ST#</span>
            </div>
            <div className="table-body">
              {rows.map((row) => (
                <div className="table-row" key={`${row.mode}-${row.symbol}`}>
                  <span className={`mode ${row.mode === "PREALERTA" ? "pre" : "alert"}`}>
                    {formatAlertMode(row.mode)}
                  </span>
                  <strong>{row.symbol}</strong>
                  <span>${row.last.toFixed(2)}</span>
                  <span className="positive">{row.changePct.toFixed(1)}%</span>
                  <span>{row.rvol.toFixed(1)}x</span>
                  <span>{formatCompact(row.volume)}</span>
                  <span>{formatCompact(row.floatValue)}</span>
                  <span>{row.yvol ? `${row.yvol.toFixed(1)}x` : "-"}</span>
                  <span>{row.stRank ?? "-"}</span>
                </div>
              ))}
              {!rows.length && <EmptyInline text="No active rows right now." />}
            </div>
          </div>
        </section>

        <section className="panel">
          <PanelTitle
            action={
              <button className="ghost-action small" onClick={() => setHistory([])} type="button">
                Clear
              </button>
            }
            title="Detection History"
            subtitle="Kept even after the ticker stops matching the active filter."
          />
          <div className="data-table appeared-table">
            <div className="table-head">
              <span>Date/Time</span>
              <span>Ticker</span>
              <span>Last</span>
              <span>%</span>
            </div>
            <div className="table-body">
              {history.map((row, index) => (
                <div className="table-row" key={`${row.symbol}-${row.time}-${index}`}>
                  <span>{row.time}</span>
                  <strong>{row.symbol}</strong>
                  <span>{row.lastSalePrice}</span>
                  <span className="positive">{row.change}</span>
                </div>
              ))}
              {!history.length && <EmptyInline text="No historical alerts yet." />}
            </div>
          </div>
        </section>
      </div>
      <AdSlot format="rectangle" label={`${routeKey} bottom ad`} placement={`${routeKey}-bottom`} />
    </div>
  )
}

function HaltsScreen({ query }: { query: UseQueryResult<HaltRow[], Error> }) {
  return (
    <div className="route-stack">
      <AdSlot format="leaderboard" label="halts top ad" placement="halts-top" />
      <section className="panel wide">
        <PanelTitle title="Trading Halts" subtitle="Live parsed Nasdaq Trader RSS feed." />
        <ScreenStatus error={query.error} isLoading={query.isLoading} />
        <div className="data-table halts-table">
          <div className="table-head">
            <span>Ticker</span>
            <span>Market</span>
            <span>Reason</span>
            <span>Date</span>
            <span>Halt</span>
            <span>Resume</span>
            <span>Name</span>
          </div>
          <div className="table-body">
            {query.data?.map((row, index) => (
              <div className="table-row" key={`${row.symbol}-${row.haltTime}-${index}`}>
                <strong>{row.symbol}</strong>
                <span>{row.market}</span>
                <span>{row.reason}</span>
                <span>{row.haltDate}</span>
                <span>{row.haltTime}</span>
                <span>{row.resumeTime || "-"}</span>
                <span>{row.name}</span>
              </div>
            ))}
            {!query.data?.length && <EmptyInline text="No halts to show yet." />}
          </div>
        </div>
      </section>
      <AdSlot format="rectangle" label="halts bottom ad" placement="halts-bottom" />
    </div>
  )
}

function BidAskScreen({
  activeTab,
  monitors,
  setActiveTab,
  setMonitors,
}: {
  activeTab: number
  monitors: BidAskMonitorState[]
  setActiveTab: Dispatch<SetStateAction<number>>
  setMonitors: Dispatch<SetStateAction<BidAskMonitorState[]>>
}) {
  const monitor = monitors.find((item) => item.id === activeTab) ?? monitors[0]
  const latest = monitor.history.at(-1)
  const updateMonitor = (updates: Partial<BidAskMonitorState>) => {
    setMonitors((current) => current.map((item) => (item.id === monitor.id ? { ...item, ...updates } : item)))
  }

  return (
    <div className="route-stack">
      <AdSlot format="leaderboard" label="bid ask top ad" placement="bid-ask-top" />
      <section className="panel wide">
        <div className="bidask-tabs">
          {monitors.map((item) => {
            const itemLatest = item.history.at(-1)
            const pct = itemLatest?.diffPct
            const label = item.symbol || item.draftSymbol || `Tab ${item.id}`
            return (
              <button
                className={`bidask-tab ${activeTab === item.id ? "active" : ""} ${item.isRunning ? "running" : "stopped"}`}
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                type="button"
              >
                <span>{label}</span>
                <small>{pct === undefined ? "N/A" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}</small>
              </button>
            )
          })}
        </div>

        <div className="monitor-controls">
          <label className="field compact">
            <span>Ticker</span>
            <input
              disabled={monitor.isRunning}
              onChange={(event) => updateMonitor({ draftSymbol: event.target.value.toUpperCase() })}
              placeholder="SCAG"
              value={monitor.draftSymbol}
            />
          </label>
          <label className="field compact">
            <span>Optional initial value</span>
            <input
              disabled={monitor.isRunning}
              onChange={(event) => updateMonitor({ draftReference: event.target.value })}
              placeholder="0.85"
              value={monitor.draftReference}
            />
          </label>
          <label className="field compact small-field">
            <span>Refresh</span>
            <input
              disabled={monitor.isRunning}
              min={1}
              onChange={(event) => updateMonitor({ refreshSeconds: Math.max(1, Number(event.target.value)) })}
              type="number"
              value={monitor.refreshSeconds}
            />
          </label>
          <button
            className={monitor.isRunning ? "danger-action" : "primary-action"}
            onClick={() => {
              if (monitor.isRunning) {
                updateMonitor({ isRunning: false })
                return
              }

              const reference = parseMarketNumber(monitor.draftReference)
              updateMonitor({
                history: [],
                isRunning: true,
                reference: reference || undefined,
                symbol: monitor.draftSymbol.trim().toUpperCase(),
              })
            }}
            type="button"
          >
            {monitor.isRunning ? "Stop monitoring" : "Start monitoring"}
          </button>
          <button className="ghost-action" onClick={() => updateMonitor({ history: [] })} type="button">
            Clear
          </button>
        </div>

        <div className="monitor-summary">
          <span>Status: {monitor.isRunning ? "Running" : "Stopped"}</span>
          <span>Price: {latest ? `$${latest.price.toFixed(2)}` : "-"}</span>
          <span className={latest?.diffPct && latest.diffPct >= 0 ? "positive" : "negative"}>
            Delta: {latest?.diffPct === undefined ? "-" : `${latest.diffPct.toFixed(2)}%`}
          </span>
          <span>Force: {latest?.forceIndex?.toFixed(2) ?? "-"}</span>
        </div>

        <div className="data-table bidask-table">
          <div className="table-head">
            <span>Date/Time</span>
            <span>Price</span>
            <span>Delta</span>
            <span>Status</span>
            <span>Volume</span>
            <span>Vol%</span>
            <span>Force</span>
          </div>
          <div className="table-body monitor-body">
            {[...monitor.history].reverse().map((row, index) => (
              <div className="table-row" key={`${row.time}-${index}`}>
                <span>{row.time}</span>
                <strong>${row.price.toFixed(2)}</strong>
                <span className={(row.diffPct ?? 0) >= 0 ? "positive" : "negative"}>
                  {row.diffPct === undefined ? "-" : `${row.diffPct.toFixed(2)}%`}
                </span>
                <span className={`state ${row.status.toLowerCase()}`}>{formatBidAskStatus(row.status)}</span>
                <span>{formatCompact(row.volume)}</span>
                <span>{row.volumeChangePct === undefined ? "-" : `${row.volumeChangePct.toFixed(1)}%`}</span>
                <span>{row.forceIndex?.toFixed(2) ?? "-"}</span>
              </div>
            ))}
            {!monitor.history.length && <EmptyInline text="No samples yet. Press Start monitoring." />}
          </div>
        </div>
      </section>
      <AdSlot format="rectangle" label="bid ask bottom ad" placement="bid-ask-bottom" />
    </div>
  )
}

function StockMonitorRoute({
  setLogs,
  sonnerNotificationsEnabled,
  systemNotificationsEnabled,
}: {
  setLogs: Dispatch<SetStateAction<RequestLog[]>>
  sonnerNotificationsEnabled: boolean
  systemNotificationsEnabled: boolean
}) {
  const params = useParams()
  const ticker = normalizeTicker(params.ticker)

  if (!ticker) {
    return <Navigate replace to="/bid-ask" />
  }

  return (
    <StockMonitorScreen
      key={ticker}
      setLogs={setLogs}
      sonnerNotificationsEnabled={sonnerNotificationsEnabled}
      systemNotificationsEnabled={systemNotificationsEnabled}
      ticker={ticker}
    />
  )
}

function StockMonitorScreen({
  setLogs,
  sonnerNotificationsEnabled,
  systemNotificationsEnabled,
  ticker,
}: {
  setLogs: Dispatch<SetStateAction<RequestLog[]>>
  sonnerNotificationsEnabled: boolean
  systemNotificationsEnabled: boolean
  ticker: string
}) {
  const [monitor, setMonitor] = useLocalStorage<BidAskMonitorState>(`rocket.stockMonitor.${ticker}`, {
    id: 0,
    draftReference: "",
    draftSymbol: ticker,
    history: [],
    isRunning: false,
    refreshSeconds: 3,
    symbol: ticker,
  })
  const latest = monitor.history.at(-1)
  const lastEventRef = useRef("")
  const updateMonitor = (updates: Partial<BidAskMonitorState>) => {
    setMonitor((current) => ({ ...current, ...updates }))
  }
  const setHistory: Dispatch<SetStateAction<BidAskSnapshot[]>> = (nextHistory) => {
    setMonitor((current) => ({
      ...current,
      history:
        typeof nextHistory === "function"
          ? (nextHistory as (history: BidAskSnapshot[]) => BidAskSnapshot[])(current.history)
          : nextHistory,
    }))
  }
  const query = useBidAskMonitor(
    monitor.symbol,
    monitor.reference,
    monitor.refreshSeconds,
    setHistory,
    monitor.isRunning,
  )

  useQueryLogger(`Stock ${ticker}`, query, setLogs)

  useEffect(() => {
    const symbol = monitor.symbol || ticker
    const reference = (monitor.reference ?? parseMarketNumber(monitor.draftReference)) || 1

    if (!latest) {
      document.title = `${symbol} Stock Monitor`
      return
    }

    const diffPct = ((latest.price - reference) / reference) * 100
    document.title = `${symbol} ${formatTitlePercent(diffPct)} ${latest.price.toFixed(2)} ${formatTitleNumber(reference)}`
  }, [latest, monitor.draftReference, monitor.reference, monitor.symbol, ticker])

  useEffect(() => {
    return () => {
      document.title = "StockGoing"
    }
  }, [])

  useEffect(() => {
    if (!query.data || query.data.status === "PRIMER") {
      return
    }

    if (query.data.status === "SUBE" || query.data.status === "BAJA" || (query.data.forceIndex ?? 0) > 2) {
      const eventKey = `${ticker}-${query.data.status}-${Math.trunc(query.data.diffPct ?? 0)}-${Math.trunc(query.data.forceIndex ?? 0)}`
      if (lastEventRef.current === eventKey) {
        return
      }

      lastEventRef.current = eventKey
      notify(
        `Stock ${monitor.symbol}`,
        `${formatBidAskStatus(query.data.status)} ${query.data.diffPct?.toFixed(2) ?? "N/A"}% | Price $${query.data.price.toFixed(2)} | Force ${query.data.forceIndex?.toFixed(2) ?? "N/A"}`,
        {
          sonnerEnabled: sonnerNotificationsEnabled,
          systemEnabled: systemNotificationsEnabled,
        },
      )
    }
  }, [monitor.symbol, query.data, sonnerNotificationsEnabled, systemNotificationsEnabled, ticker])

  return (
    <div className="route-stack">
      <AdSlot format="leaderboard" label={`${ticker} stock monitor top ad`} placement="stock-top" />
      <section className="panel wide stock-monitor-panel">
        <PanelTitle
          title={`${monitor.symbol || ticker} Stock Monitor`}
          subtitle="Single-ticker monitoring with its own timer, reference price, alerts, and history."
        />
        <ScreenStatus error={query.error} isLoading={query.isLoading} />

        <div className="monitor-controls stock-monitor-controls">
          <label className="field compact">
            <span>Ticker</span>
            <input
              disabled={monitor.isRunning}
              onChange={(event) => updateMonitor({ draftSymbol: event.target.value.toUpperCase() })}
              placeholder={ticker}
              value={monitor.draftSymbol}
            />
          </label>
          <label className="field compact">
            <span>Optional initial value</span>
            <input
              disabled={monitor.isRunning}
              onChange={(event) => updateMonitor({ draftReference: event.target.value })}
              placeholder="0.85"
              value={monitor.draftReference}
            />
          </label>
          <label className="field compact small-field">
            <span>Refresh</span>
            <input
              disabled={monitor.isRunning}
              min={1}
              onChange={(event) => updateMonitor({ refreshSeconds: Math.max(1, Number(event.target.value)) })}
              type="number"
              value={monitor.refreshSeconds}
            />
          </label>
          <button
            className={monitor.isRunning ? "danger-action" : "primary-action"}
            onClick={() => {
              if (monitor.isRunning) {
                updateMonitor({ isRunning: false })
                return
              }

              const reference = parseMarketNumber(monitor.draftReference)
              const nextSymbol = normalizeTicker(monitor.draftSymbol) || ticker
              updateMonitor({
                history: [],
                isRunning: true,
                reference: reference || undefined,
                symbol: nextSymbol,
              })
            }}
            type="button"
          >
            {monitor.isRunning ? "Stop monitoring" : "Start monitoring"}
          </button>
          <button className="ghost-action" onClick={() => updateMonitor({ history: [] })} type="button">
            Clear
          </button>
        </div>

        <div className="monitor-summary">
          <span>Status: {monitor.isRunning ? "Running" : "Stopped"}</span>
          <span>Timer: {monitor.refreshSeconds}s</span>
          <span>Price: {latest ? `$${latest.price.toFixed(2)}` : "-"}</span>
          <span className={latest?.diffPct && latest.diffPct >= 0 ? "positive" : "negative"}>
            Delta: {latest?.diffPct === undefined ? "-" : `${latest.diffPct.toFixed(2)}%`}
          </span>
          <span>Force: {latest?.forceIndex?.toFixed(2) ?? "-"}</span>
        </div>

        <div className="data-table bidask-table">
          <div className="table-head">
            <span>Date/Time</span>
            <span>Price</span>
            <span>Delta</span>
            <span>Status</span>
            <span>Volume</span>
            <span>Vol%</span>
            <span>Force</span>
          </div>
          <div className="table-body monitor-body">
            {[...monitor.history].reverse().map((row, index) => (
              <div className="table-row" key={`${row.time}-${index}`}>
                <span>{row.time}</span>
                <strong>${row.price.toFixed(2)}</strong>
                <span className={(row.diffPct ?? 0) >= 0 ? "positive" : "negative"}>
                  {row.diffPct === undefined ? "-" : `${row.diffPct.toFixed(2)}%`}
                </span>
                <span className={`state ${row.status.toLowerCase()}`}>{formatBidAskStatus(row.status)}</span>
                <span>{formatCompact(row.volume)}</span>
                <span>{row.volumeChangePct === undefined ? "-" : `${row.volumeChangePct.toFixed(1)}%`}</span>
                <span>{row.forceIndex?.toFixed(2) ?? "-"}</span>
              </div>
            ))}
            {!monitor.history.length && <EmptyInline text="No samples yet. Press Start monitoring." />}
          </div>
        </div>
      </section>
      <AdSlot format="rectangle" label={`${ticker} stock monitor bottom ad`} placement="stock-bottom" />
    </div>
  )
}

function ConfigurationScreen({
  logs,
  refreshSeconds,
  setLogs,
  setRefreshSeconds,
  setSonnerNotificationsEnabled,
  setSystemNotificationsEnabled,
  sonnerNotificationsEnabled,
  systemNotificationsEnabled,
  setTheme,
  theme,
}: {
  logs: RequestLog[]
  refreshSeconds: number
  setLogs: Dispatch<SetStateAction<RequestLog[]>>
  setRefreshSeconds: Dispatch<SetStateAction<number>>
  setSonnerNotificationsEnabled: Dispatch<SetStateAction<boolean>>
  setSystemNotificationsEnabled: Dispatch<SetStateAction<boolean>>
  sonnerNotificationsEnabled: boolean
  systemNotificationsEnabled: boolean
  setTheme: (theme: "dark" | "light" | "system") => void
  theme: "dark" | "light" | "system"
}) {
  const [tab, setTab] = useState<"general" | "logs">("general")
  const [value, setValue] = useState(refreshSeconds)
  const [notificationPermission, setNotificationPermission] = useState(getBrowserNotificationPermission())

  useEffect(() => {
    const refreshPermission = () => setNotificationPermission(getBrowserNotificationPermission())
    window.addEventListener("focus", refreshPermission)
    return () => window.removeEventListener("focus", refreshPermission)
  }, [])

  return (
    <div className="route-stack">
      <AdSlot format="leaderboard" label="configuration top ad" placement="configuration-top" />
      <section className="panel wide configuration-panel">
        <div className="tabs">
          <button className={tab === "general" ? "active" : ""} onClick={() => setTab("general")} type="button">
            General
          </button>
          <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")} type="button">
            Request Log
          </button>
        </div>

        {tab === "general" && (
          <div className="settings-grid">
            <label className="field">
              <span>Refresh general scanners every</span>
              <div className="input-row">
                <input min={3} onChange={(event) => setValue(Number(event.target.value))} type="number" value={value} />
                <span>seconds</span>
              </div>
            </label>

            <label className="field">
              <span>Theme</span>
              <select onChange={(event) => setTheme(event.target.value as "dark" | "light" | "system")} value={theme}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>

            <label className="toggle-field">
              <input
                checked={sonnerNotificationsEnabled}
                onChange={(event) => setSonnerNotificationsEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>Enable Sonner toast notifications</span>
            </label>

            <label className="toggle-field">
              <input
                checked={systemNotificationsEnabled}
                disabled={notificationPermission === "unsupported" || notificationPermission === "denied"}
                onChange={async (event) => {
                  if (event.target.checked) {
                    const ok = await requestBrowserNotifications()
                    setNotificationPermission(getBrowserNotificationPermission())
                    setSystemNotificationsEnabled(ok)
                    if (ok) {
                      notify("Rocket Screeners", "System notifications are enabled.", {
                        sonnerEnabled: sonnerNotificationsEnabled,
                        systemEnabled: true,
                      })
                    } else {
                      toast.error("Notifications were not enabled", {
                        description: "The browser denied or does not support system notifications.",
                      })
                    }
                    return
                  }
                  setSystemNotificationsEnabled(false)
                }}
                type="checkbox"
              />
              <span>Enable system/browser notifications</span>
            </label>

            <div className={`permission-card ${notificationPermission}`}>
              <strong>Browser notification permission: {formatNotificationPermission(notificationPermission)}</strong>
              <p>{getNotificationPermissionMessage(notificationPermission)}</p>
            </div>

            <div className="settings-actions">
              <button className="primary-action" onClick={() => setRefreshSeconds(Math.max(3, value))} type="button">
                Save refresh
              </button>
              <button
                className="ghost-action"
                onClick={() =>
                  notify("Rocket Screeners", "Test notification is working.", {
                    sonnerEnabled: sonnerNotificationsEnabled,
                    systemEnabled: systemNotificationsEnabled,
                  })
                }
                type="button"
              >
                Test notification
              </button>
            </div>
          </div>
        )}

        {tab === "logs" && (
          <>
            <PanelTitle
              action={
                <button className="ghost-action small" onClick={() => setLogs([])} type="button">
                  Clear
                </button>
              }
              title="Recent Requests"
              subtitle="Latest OK and error events from each scanner."
            />
            <div className="data-table log-table">
              <div className="table-head">
                <span>Time</span>
                <span>Source</span>
                <span>Status</span>
                <span>Message</span>
              </div>
              <div className="table-body">
                {logs.map((log) => (
                  <div className="table-row" key={log.id}>
                    <span>{log.time}</span>
                    <strong>{log.source}</strong>
                    <span className={log.status === "OK" ? "positive" : "negative"}>{log.status}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
                {!logs.length && <EmptyInline text="No logs yet." />}
              </div>
            </div>
          </>
        )}
      </section>
      <AdSlot format="rectangle" label="configuration bottom ad" placement="configuration-bottom" />
    </div>
  )
}

function BidAskMonitorRuntime({
  monitor,
  setEventCounts,
  setLogs,
  setMonitors,
  sonnerNotificationsEnabled,
  systemNotificationsEnabled,
}: {
  monitor: BidAskMonitorState
  setEventCounts: Dispatch<SetStateAction<Partial<Record<ScreenId, number>>>>
  setLogs: Dispatch<SetStateAction<RequestLog[]>>
  setMonitors: Dispatch<SetStateAction<BidAskMonitorState[]>>
  sonnerNotificationsEnabled: boolean
  systemNotificationsEnabled: boolean
}) {
  const setHistory: Dispatch<SetStateAction<BidAskSnapshot[]>> = (nextHistory) => {
    setMonitors((current) =>
      current.map((item) =>
        item.id === monitor.id
          ? {
              ...item,
              history:
                typeof nextHistory === "function"
                  ? (nextHistory as (history: BidAskSnapshot[]) => BidAskSnapshot[])(item.history)
                  : nextHistory,
            }
          : item,
      ),
    )
  }

  const query = useBidAskMonitor(
    monitor.symbol,
    monitor.reference,
    monitor.refreshSeconds,
    setHistory,
    monitor.isRunning,
  )
  const lastEventRef = useRef("")

  useQueryLogger(`BidAsk ${monitor.id}`, query, setLogs)

  useEffect(() => {
    const latest = query.data
    if (!latest || latest.status === "PRIMER") {
      return
    }

    if (latest.status === "SUBE" || latest.status === "BAJA" || (latest.forceIndex ?? 0) > 2) {
      const eventKey = `${monitor.id}-${latest.status}-${Math.trunc(latest.diffPct ?? 0)}-${Math.trunc(latest.forceIndex ?? 0)}`
      if (lastEventRef.current === eventKey) {
        return
      }

      lastEventRef.current = eventKey
      setEventCounts((current) => ({ ...current, bidask: (current.bidask ?? 0) + 1 }))
      notify(
        `Bid/Ask ${monitor.symbol}`,
        `${formatBidAskStatus(latest.status)} ${latest.diffPct?.toFixed(2) ?? "N/A"}% | Price $${latest.price.toFixed(2)} | Force ${latest.forceIndex?.toFixed(2) ?? "N/A"}`,
        {
          sonnerEnabled: sonnerNotificationsEnabled,
          systemEnabled: systemNotificationsEnabled,
        },
      )
    }
  }, [monitor.id, monitor.symbol, query.data, setEventCounts, sonnerNotificationsEnabled, systemNotificationsEnabled])

  return null
}

function PanelTitle({
  action,
  subtitle,
  title,
}: {
  action?: React.ReactNode
  subtitle: string
  title: string
}) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

function ScreenStatus({ error, isLoading }: { error: Error | null; isLoading: boolean }) {
  if (isLoading) {
    return <p className="status-text">Loading data...</p>
  }

  if (error) {
    return <p className="error-text">Error: {error.message}</p>
  }

  return null
}

function EmptyInline({ text }: { text: string }) {
  return <div className="empty-inline">{text}</div>
}

function MiniList({ rows }: { rows?: Array<{ symbol: string; meta: string }> }) {
  if (!rows?.length) {
    return <EmptyInline text="No data yet." />
  }

  return (
    <div className="mini-list">
      {rows.map((row, index) => (
        <div key={`${row.symbol}-${index}`}>
          <strong>{row.symbol}</strong>
          <span>{row.meta}</span>
        </div>
      ))}
    </div>
  )
}

function useMovers(kind: MoverKind, refreshSeconds: number): UseQueryResult<MoverRow[], Error> {
  return useQuery<MoverRow[], Error>({
    queryKey: ["movers", kind],
    queryFn: async () => {
      const json = await fetchJson<{
        data?: {
          STOCKS?: {
            MostAdvanced?: { table?: { rows?: MoverRow[] } }
            MostDeclined?: { table?: { rows?: MoverRow[] } }
          }
        }
      }>(marketMoversUrl)
      const rows =
        kind === "gainers"
          ? json.data?.STOCKS?.MostAdvanced?.table?.rows
          : json.data?.STOCKS?.MostDeclined?.table?.rows

      return (rows ?? []).slice(0, 10)
    },
    refetchInterval: refreshSeconds * 1000,
    refetchIntervalInBackground: true,
  })
}

function useAlerts(refreshSeconds: number): UseQueryResult<AlertRow[], Error> {
  return useQuery<AlertRow[], Error>({
    queryKey: ["alerts"],
    queryFn: async () => {
      const [moversJson, stocktwitsJson] = await Promise.all([
        fetchJson<{
          data?: { STOCKS?: { MostAdvanced?: { table?: { rows?: MoverRow[] } } } }
        }>(marketMoversUrl),
        fetchJson<{ most_active?: StocktwitsItem[] }>(stocktwitsUrl),
      ])

      const stocktwits = new Map((stocktwitsJson.most_active ?? []).map((item) => [item.symbol.toUpperCase(), item]))
      const candidates = (moversJson.data?.STOCKS?.MostAdvanced?.table?.rows ?? [])
        .map((row) => ({
          row,
          changePct: parseMarketNumber(row.change),
          price: parseMarketNumber(row.lastSalePrice),
        }))
        .filter((item) => item.price >= 0.2 && item.price <= 20 && item.changePct >= 3 && item.changePct <= 80)

      const enriched: Array<AlertRow | null> = await Promise.all(
        candidates.slice(0, 20).map(async ({ row }) => {
          const summary = await fetchNasdaqSummary(row.symbol)
          const yahoo = await fetchYahooChart(row.symbol)
          const st = stocktwits.get(row.symbol.toUpperCase())
          const floatValue = normalizeStocktwitsFloat(st?.fundamentals?.FloatCurrent) ?? summary.floatEstimate
          const volume = summary.volume || st?.price_data?.Volume || 0
          const avgVolume = summary.avgVolume || Number(st?.fundamentals?.AverageDailyVolumeLastMonth ?? 0)
          const rvol = avgVolume > 0 ? volume / avgVolume : 0
          const last = summary.last || parseMarketNumber(row.lastSalePrice)
          const changePct = summary.changePct || parseMarketNumber(row.change)
          const hodPct = yahoo.dayHigh > 0 ? (yahoo.last / yahoo.dayHigh) * 100 : undefined
          const lowFloatPass = floatValue === undefined || floatValue <= 20000000
          const nearHighOfDay = hodPct === undefined || hodPct >= 97
          const intradayVolumePulse = yahoo.recentVolumeRatio >= 3 || yahoo.breaksRecentHigh

          const isPre =
            last >= 0.2 &&
            last <= 10 &&
            changePct >= 3 &&
            changePct <= 25 &&
            rvol >= 2 &&
            volume >= 100000 &&
            lowFloatPass &&
            intradayVolumePulse

          const isAlert =
            last >= 0.5 &&
            last <= 20 &&
            changePct >= 10 &&
            changePct <= 80 &&
            rvol > 5 &&
            volume > 1000000 &&
            lowFloatPass &&
            nearHighOfDay

          if (!isPre && !isAlert) {
            return null
          }

          const alertRow: AlertRow = {
            symbol: row.symbol,
            last,
            changePct,
            rvol,
            volume,
            floatValue,
            hodPct,
            yvol: yahoo.recentVolumeRatio,
            stRank: st?.rank,
            stScore: st?.trending_score,
            mode: isPre ? "PREALERTA" : "ALERTA",
          }

          return alertRow
        }),
      )

      return enriched.filter((row): row is AlertRow => row !== null).sort((a, b) => b.rvol - a.rvol)
    },
    refetchInterval: refreshSeconds * 1000,
    refetchIntervalInBackground: true,
  })
}

function useHalts(refreshSeconds: number): UseQueryResult<HaltRow[], Error> {
  return useQuery<HaltRow[], Error>({
    queryKey: ["halts"],
    queryFn: async () => {
      const text = await fetchText(haltsUrl)
      if (isHtmlResponse(text)) {
        return fetchHaltsFromNasdaqTraderPage()
      }

      const firstXml = text.search(/<\?xml|<rss/i)
      const cleaned = firstXml > 0 ? text.slice(firstXml) : text
      const doc = new DOMParser().parseFromString(cleaned.trim(), "text/xml")
      if (doc.querySelector("parsererror")) {
        return fetchHaltsFromNasdaqTraderPage()
      }

      return Array.from(doc.querySelectorAll("item"))
        .slice(0, 80)
        .map((item) => ({
          symbol: readXml(item, "IssueSymbol") || item.querySelector("title")?.textContent?.trim() || "-",
          name: readXml(item, "IssueName") || "-",
          market: readXml(item, "Market") || "-",
          reason: readXml(item, "ReasonCode") || "-",
          haltDate: readXml(item, "HaltDate") || "-",
          haltTime: readXml(item, "HaltTime") || "-",
          resumeTime: readXml(item, "ResumptionTradeTime") || readXml(item, "ResumptionQuoteTime") || "",
        }))
    },
    refetchInterval: refreshSeconds * 1000,
  })
}

function useBidAskMonitor(
  symbol: string,
  reference: number | undefined,
  refreshSeconds: number,
  setHistory: Dispatch<SetStateAction<BidAskSnapshot[]>>,
  isRunning: boolean,
): UseQueryResult<BidAskSnapshot | null, Error> {
  return useQuery<BidAskSnapshot | null, Error>({
    enabled: Boolean(symbol) && isRunning,
    queryKey: ["bidask-monitor", symbol, reference, isRunning],
    queryFn: async () => {
      const json = await fetchJson<{
        data?: { primaryData?: { lastSalePrice?: string; volume?: string } }
      }>(`/nasdaq/api/quote/${symbol}/info?assetclass=stocks`)

      const price = parseMarketNumber(json.data?.primaryData?.lastSalePrice)
      const volume = parseMarketNumber(json.data?.primaryData?.volume)
      if (!price) {
        return null
      }

      return createBidAskSnapshot(price, volume, reference, setHistory)
    },
    refetchInterval: refreshSeconds * 1000,
    refetchIntervalInBackground: true,
  })
}

function useAlertHistory(rows: AlertRow[], setHistory: Dispatch<SetStateAction<AppearedRow[]>>) {
  const previousKeysRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!rows.length) {
      return
    }

    const currentKeys = new Set(rows.map((row) => `${row.mode}-${row.symbol}`))
    const previousKeys = previousKeysRef.current
    if (previousKeys) {
      const newRows = rows
        .filter((row) => !previousKeys.has(`${row.mode}-${row.symbol}`))
        .map((row) => ({
          symbol: row.symbol,
          lastSalePrice: `$${row.last.toFixed(2)}`,
          change: `${row.changePct.toFixed(1)}%`,
          time: new Date().toLocaleString(),
        }))

      if (newRows.length) {
        setHistory((current) => [...newRows, ...current].slice(0, 200))
      }
    }

    previousKeysRef.current = currentKeys
  }, [rows, setHistory])
}

function useNewRowsNotification<T>({
  getKey,
  getMessage,
  rows,
  screen,
  setEventCounts,
  sonnerEnabled,
  systemEnabled,
}: {
  getKey: (row: T) => string
  getMessage: (row: T) => string
  rows?: T[]
  screen: ScreenId
  setEventCounts: Dispatch<SetStateAction<Partial<Record<ScreenId, number>>>>
  sonnerEnabled: boolean
  systemEnabled: boolean
}) {
  const previousKeysRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!rows?.length) {
      return
    }

    const currentKeys = new Set(rows.map(getKey))
    const previousKeys = previousKeysRef.current
    if (previousKeys) {
      const newRows = rows.filter((row) => !previousKeys.has(getKey(row)))
      if (newRows.length) {
        setEventCounts((current) => ({
          ...current,
          [screen]: (current[screen] ?? 0) + newRows.length,
        }))

        for (const row of newRows.slice(0, 3)) {
          notify("Rocket Screeners", getMessage(row), { sonnerEnabled, systemEnabled })
        }
      }
    }

    previousKeysRef.current = currentKeys
  }, [getKey, getMessage, rows, screen, setEventCounts, sonnerEnabled, systemEnabled])
}

function useQueryLogger<T>(
  source: string,
  query: UseQueryResult<T, Error>,
  setLogs: Dispatch<SetStateAction<RequestLog[]>>,
) {
  const lastSuccessRef = useRef(0)
  const lastErrorRef = useRef(0)

  useEffect(() => {
    if (query.dataUpdatedAt && query.dataUpdatedAt !== lastSuccessRef.current) {
      lastSuccessRef.current = query.dataUpdatedAt
      setLogs((current) =>
        [
          {
            id: `${source}-${query.dataUpdatedAt}-ok`,
            source,
            status: "OK" as const,
            message: "Request updated successfully.",
            time: new Date(query.dataUpdatedAt).toLocaleString(),
          },
          ...current,
        ].slice(0, 250),
      )
    }
  }, [query.dataUpdatedAt, setLogs, source])

  useEffect(() => {
    if (query.errorUpdatedAt && query.errorUpdatedAt !== lastErrorRef.current) {
      lastErrorRef.current = query.errorUpdatedAt
      setLogs((current) =>
        [
          {
            id: `${source}-${query.errorUpdatedAt}-error`,
            source,
            status: "ERROR" as const,
            message: query.error?.message ?? "Unknown error.",
            time: new Date(query.errorUpdatedAt).toLocaleString(),
          },
          ...current,
        ].slice(0, 250),
      )
    }
  }, [query.error?.message, query.errorUpdatedAt, setLogs, source])
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json,text/plain,*/*" } })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  const trimmed = text.trimStart()
  if (trimmed.startsWith("<")) {
    throw new Error(buildUnexpectedResponseError(url, "JSON", text))
  }

  try {
    return JSON.parse(text) as T
  } catch (error) {
    throw new Error(
      `Unable to parse JSON from ${url}. ${error instanceof Error ? error.message : "Unknown parse error."}`,
      { cause: error },
    )
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: "application/rss+xml,text/xml,text/plain,*/*" } })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.text()
}

async function fetchHaltsFromNasdaqTraderPage(): Promise<HaltRow[]> {
  const html = await fetchText(haltsPageUrl)
  if (isIncapsulaBlock(html)) {
    throw new Error("Nasdaq Trader blocked the halts feed with Incapsula. Try redeploying or use a server IP that Nasdaq Trader allows.")
  }

  const doc = new DOMParser().parseFromString(html, "text/html")
  const rows = Array.from(doc.querySelectorAll("table tr"))
    .map((row) => Array.from(row.querySelectorAll("td")).map((cell) => normalizeText(cell.textContent)))
    .filter((cells) => cells.length >= 5)
    .map((cells) => ({
      haltDate: cells[0] || "-",
      haltTime: cells[1] || "-",
      symbol: cells[2] || "-",
      name: cells[3] || "-",
      market: cells[4] || "-",
      reason: cells[5] || "-",
      resumeTime: cells[7] || cells[6] || "",
    }))
    .filter((row) => row.symbol !== "-" && !/symbol|security/i.test(row.symbol))

  if (rows.length) {
    return rows.slice(0, 80)
  }

  if (doc.querySelector("#divTradeHaltResults")) {
    return []
  }

  throw new Error(buildUnexpectedResponseError(haltsPageUrl, "Nasdaq Trader halts HTML", html))
}

async function fetchNasdaqSummary(symbol: string) {
  const [info, summary] = await Promise.all([
    fetchJson<{
      data?: { primaryData?: { lastSalePrice?: string; percentageChange?: string } }
    }>(`/nasdaq/api/quote/${symbol}/info?assetclass=stocks`),
    fetchJson<{
      data?: { summaryData?: Record<string, { value?: string }> }
    }>(`/nasdaq/api/quote/${symbol}/summary?assetclass=stocks`),
  ])

  const last = parseMarketNumber(info.data?.primaryData?.lastSalePrice)
  const changePct = parseMarketNumber(info.data?.primaryData?.percentageChange)
  const volume = parseMarketNumber(summary.data?.summaryData?.ShareVolume?.value)
  const avgVolume = parseMarketNumber(summary.data?.summaryData?.AverageVolume?.value)
  const marketCap = parseMarketNumber(summary.data?.summaryData?.MarketCap?.value)

  return {
    last,
    changePct,
    volume,
    avgVolume,
    floatEstimate: last > 0 && marketCap > 0 ? marketCap / last : undefined,
  }
}

async function fetchYahooChart(symbol: string) {
  const json = await fetchJson<{
    chart?: {
      result?: Array<{
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>
            high?: Array<number | null>
            volume?: Array<number | null>
          }>
        }
      }>
    }
  }>(`/yahoo/v8/finance/chart/${symbol.toLowerCase()}?interval=2m`)

  const quote = json.chart?.result?.[0]?.indicators?.quote?.[0]
  const closes = (quote?.close ?? []).filter((value): value is number => value !== null)
  const highs = (quote?.high ?? []).filter((value): value is number => value !== null)
  const volumes = (quote?.volume ?? []).filter((value): value is number => value !== null && value > 0)
  const last = closes.at(-1) ?? 0
  const lastHigh = highs.at(-1) ?? 0
  const dayHigh = Math.max(...highs, 0)
  const lookbackHighs = highs.slice(Math.max(0, highs.length - 31), Math.max(0, highs.length - 1))
  const recentHigh = Math.max(...lookbackHighs, 0)
  const recentVolume = volumes.slice(-3).reduce((sum, value) => sum + value, 0)
  const avgVolume = volumes.length ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length : 0
  const recentVolumeRatio = avgVolume > 0 ? recentVolume / (avgVolume * 3) : 0

  return {
    last,
    dayHigh,
    recentVolumeRatio,
    breaksRecentHigh: recentHigh > 0 && lastHigh > recentHigh * 1.01,
  }
}

function createBidAskSnapshot(
  price: number,
  volume: number,
  reference: number | undefined,
  setHistory: Dispatch<SetStateAction<BidAskSnapshot[]>>,
) {
  const time = new Date().toLocaleString()
  let created: BidAskSnapshot | null = null

  setHistory((current) => {
    const initialPrice = reference ?? current[0]?.price ?? price
    const diffPct =
      current.length === 0 && reference === undefined ? undefined : ((price - initialPrice) / initialPrice) * 100
    const lastVolumes = [...current.map((row) => row.volume), volume].slice(-10)
    const lastThree = lastVolumes.slice(-3)
    const avgLastThree = lastThree.reduce((sum, value) => sum + value, 0) / lastThree.length
    const volumeChangePct = lastThree.length >= 3 && avgLastThree > 0 ? ((volume - avgLastThree) / avgLastThree) * 100 : undefined
    const previousVolume = current.at(-1)?.volume
    const deltas = current
      .map((row, index, rows) => (index === 0 ? 0 : row.volume - rows[index - 1].volume))
      .filter((value) => value !== 0)
      .slice(-10)
    const deltaVolume = previousVolume === undefined ? undefined : volume - previousVolume
    const avgDelta = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0
    const forceIndex = deltaVolume !== undefined && avgDelta > 0 ? deltaVolume / avgDelta : undefined
    const status = diffPct === undefined ? "PRIMER" : diffPct >= 5 ? "SUBE" : diffPct <= -5 ? "BAJA" : "ESTABLE"

    created = {
      time,
      price,
      diffPct,
      status,
      volume,
      volumeChangePct,
      forceIndex,
    }

    return [...current, created].slice(-80)
  })

  return created
}

function parseMarketNumber(value?: string | number | null) {
  if (value === undefined || value === null) {
    return 0
  }

  const raw = String(value).trim()
  if (!raw || raw === "N/A") {
    return 0
  }

  const multiplier = raw.toUpperCase().endsWith("B")
    ? 1_000_000_000
    : raw.toUpperCase().endsWith("M")
      ? 1_000_000
      : raw.toUpperCase().endsWith("K")
        ? 1_000
        : 1
  const clean = raw.replace(/[$,%]/g, "").replace(/,/g, "").replace(/[KMB]$/i, "")
  const parsed = Number(clean)
  return Number.isFinite(parsed) ? parsed * multiplier : 0
}

function normalizeText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function isHtmlResponse(value: string) {
  return value.trimStart().startsWith("<!doctype") || value.trimStart().startsWith("<html")
}

function isIncapsulaBlock(value: string) {
  return /Incapsula|_Incapsula_Resource|Request unsuccessful/i.test(value)
}

function buildUnexpectedResponseError(url: string, expected: string, body: string) {
  const preview = normalizeText(body).slice(0, 120)
  if (isIncapsulaBlock(body)) {
    return `Expected ${expected} from ${url}, but Nasdaq/security protection returned an Incapsula HTML page.`
  }

  if (isHtmlResponse(body)) {
    return `Expected ${expected} from ${url}, but received HTML instead. Preview: ${preview}`
  }

  return `Expected ${expected} from ${url}, but received an unexpected response. Preview: ${preview}`
}

function normalizeStocktwitsFloat(value?: string | number) {
  const parsed = parseMarketNumber(value)
  if (!parsed) {
    return undefined
  }

  return parsed < 100000 ? parsed * 1_000_000 : parsed
}

function formatAlertMode(mode: AlertRow["mode"]) {
  return mode === "PREALERTA" ? "PRE-ALERT" : "RUNNER"
}

function formatBidAskStatus(status: BidAskSnapshot["status"]) {
  const labels: Record<BidAskSnapshot["status"], string> = {
    PRIMER: "FIRST",
    SUBE: "UP",
    BAJA: "DOWN",
    ESTABLE: "STABLE",
  }

  return labels[status]
}

function formatCompact(value?: number) {
  if (!value) {
    return "-"
  }

  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function formatTitlePercent(value: number) {
  const rounded = Math.round(value * 100) / 100
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2)
  return `${rounded > 0 ? "+" : ""}${formatted}%`
}

function formatTitleNumber(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
}

function readXml(item: Element, tagName: string) {
  return Array.from(item.getElementsByTagName("*"))
    .find((node) => node.localName === tagName)
    ?.textContent?.trim()
}

function getBrowserNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported" as const
  }

  return Notification.permission
}

function formatNotificationPermission(permission: NotificationPermission | "unsupported") {
  const labels: Record<NotificationPermission | "unsupported", string> = {
    default: "Not requested",
    denied: "Blocked",
    granted: "Allowed",
    unsupported: "Unsupported",
  }

  return labels[permission]
}

function getNotificationPermissionMessage(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") {
    return "System notifications are allowed for this site."
  }

  if (permission === "denied") {
    return "The browser has blocked notifications for this site. Click the lock/settings icon next to the URL and allow Notifications, then reload the page."
  }

  if (permission === "unsupported") {
    return "This browser or environment does not support system notifications."
  }

  return "Enable the toggle to let the browser ask for notification permission."
}

async function requestBrowserNotifications() {
  if (!("Notification" in window)) {
    return false
  }

  if (Notification.permission === "granted") {
    return true
  }

  const permission = await Notification.requestPermission()
  return permission === "granted"
}

function notify(
  title: string,
  body: string,
  {
    sonnerEnabled = true,
    systemEnabled = false,
  }: {
    sonnerEnabled?: boolean
    systemEnabled?: boolean
  } = {},
) {
  if (sonnerEnabled) {
    toast(title, { description: body })
  }

  if (!systemEnabled || !("Notification" in window) || Notification.permission !== "granted") {
    return
  }

  new Notification(title, { body })
}

export default App
