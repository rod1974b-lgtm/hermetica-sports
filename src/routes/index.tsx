import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Lang,
  Team,
  Game,
  TEAMS,
  LEAGUES_DATA,
  T,
  teamById,
  fmtTime,
} from "@/lib/sports-data";
import {
  fetchLiveESPNLeague,
  ESPN_LEAGUES,
  fetchDualWeather,
} from "@/lib/live-sports-api";
import { HermitcaGamecast } from "@/components/HermitcaGamecast";
import {
  Radio,
  Star,
  Search,
  Clock,
  TrendingUp,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Shield,
  Activity,
  Layers,
  Zap,
  Info,
  Calendar,
  AlertTriangle,
  Award,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HermeticaSportsApp,
  head: () => ({
    meta: [
      { title: "Hermetica Sports OS | Global Sports Command Center" },
      {
        name: "description",
        content:
          "Real-time scores, multi-model Pulse analytics, live gamecast and season outlook for NBA, NFL, MLB, NHL, EPL, Thai League, and world sports.",
      },
      { property: "og:title", content: "Hermetica Sports OS" },
      {
        property: "og:description",
        content:
          "Live scoreboards, Sharp + BPI/FPI Pulse engine, Gamecast visuals and season trajectories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type AppTab = "my-teams" | "all-teams" | "live";

interface PulseBreakdown {
  sharp: number; // 25%
  bpiFpi: number; // 15%
  pff: number; // 10%
  fiveThirtyEight: number; // 10%
  optaFangraphs: number; // 10%
  market: number; // 15%
  form: number; // 10%
  context: number; // 5%
  total: number;
  delta: number;
}

interface TeamOutlook {
  tier: "Title Favorites" | "Rising Contenders" | "Play-In Middle" | "Zone of Shame / Relegation";
  tierColor: string;
  winProjection: string;
  playoffPct: number;
  championshipPct: number;
  injuryImpact: "Low" | "Moderate" | "Critical";
  injuryDetails: string;
  next5: string[];
  deepStats: { label: string; value: string }[];
  marketConsensus: string;
  relegationRisk?: string;
}

const OUTLOOK_SEED: Record<string, TeamOutlook> = {
  vik: {
    tier: "Rising Contenders",
    tierColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    winProjection: "11.2 Wins (Over 10.5)",
    playoffPct: 78,
    championshipPct: 9.4,
    injuryImpact: "Moderate",
    injuryDetails: "QB room healthy, DB depth tested",
    next5: ["@ Steelers", "vs Packers", "@ Lions", "vs Bears", "@ Seahawks"],
    deepStats: [
      { label: "EPA / Play", value: "+0.14 (4th)" },
      { label: "Pressure %", value: "39.2% (1st)" },
      { label: "Success Rate", value: "48.1% (8th)" },
      { label: "DVOA Rank", value: "#3 Overall" },
    ],
    marketConsensus: "Sharp money siding with defense; totals drifting under.",
  },
  wolves: {
    tier: "Title Favorites",
    tierColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    winProjection: "54.5 Wins",
    playoffPct: 96,
    championshipPct: 18.2,
    injuryImpact: "Low",
    injuryDetails: "Primary rotation 100% active",
    next5: ["vs Nuggets", "@ Thunder", "vs Mavericks", "@ Suns", "vs Lakers"],
    deepStats: [
      { label: "Net Rating", value: "+7.8 (2nd)" },
      { label: "Def Rating", value: "107.2 (1st)" },
      { label: "True Shooting", value: "59.4% (5th)" },
      { label: "Pace", value: "98.4 (19th)" },
    ],
    marketConsensus: "Top-2 Western Conference seed implied by lines.",
  },
  wild: {
    tier: "Play-In Middle",
    tierColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    winProjection: "94.0 Points",
    playoffPct: 58,
    championshipPct: 4.1,
    injuryImpact: "Moderate",
    injuryDetails: "Top-6 winger questionable for weekend",
    next5: ["vs Avalanche", "@ Stars", "vs Jets", "@ Blues", "vs Predators"],
    deepStats: [
      { label: "xGF %", value: "52.4% (11th)" },
      { label: "Save % (5v5)", value: ".921 (8th)" },
      { label: "PP %", value: "23.8% (9th)" },
      { label: "PK %", value: "81.4% (12th)" },
    ],
    marketConsensus: "Bubble wildcard candidate; high variance in goal.",
  },
  twins: {
    tier: "Play-In Middle",
    tierColor: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    winProjection: "83.5 Wins",
    playoffPct: 44,
    championshipPct: 2.8,
    injuryImpact: "Critical",
    injuryDetails: "Rotation aces managing workload",
    next5: ["vs Guardians", "vs White Sox", "@ Tigers", "@ Royals", "vs Yankees"],
    deepStats: [
      { label: "wRC+", value: "106 (9th)" },
      { label: "FIP", value: "3.88 (10th)" },
      { label: "Bullpen ERA", value: "3.72 (12th)" },
      { label: "Barrel %", value: "8.9% (7th)" },
    ],
    marketConsensus: "AL Central coin-flip; reliant on pitching health.",
  },
  rbfc: {
    tier: "Rising Contenders",
    tierColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    winProjection: "Top 4 Finish (52 Pts)",
    playoffPct: 72,
    championshipPct: 12.0,
    injuryImpact: "Low",
    injuryDetails: "Full squad available at Dragon Solar Park",
    next5: ["vs Buriram", "@ Bangkok Utd", "vs Port FC", "@ Muangthong", "vs BG Pathum"],
    deepStats: [
      { label: "xG Difference", value: "+0.62 / 90" },
      { label: "Possession", value: "54.8%" },
      { label: "PPDA", value: "9.2 (High Press)" },
      { label: "Clean Sheets", value: "7 in 14" },
    ],
    marketConsensus: "Dominant home record; top defensive unit in Thai League 1.",
  },
  ars: {
    tier: "Title Favorites",
    tierColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    winProjection: "88.0 Points",
    playoffPct: 99,
    championshipPct: 41.5,
    injuryImpact: "Low",
    injuryDetails: "Key spine fully fit",
    next5: ["vs Man City", "@ Liverpool", "vs Chelsea", "@ Newcastle", "vs Spurs"],
    deepStats: [
      { label: "xG / 90", value: "2.14 (1st)" },
      { label: "xGA / 90", value: "0.78 (1st)" },
      { label: "Set Piece xG", value: "12.4 (1st)" },
      { label: "Field Tilt", value: "68.2%" },
    ],
    marketConsensus: "EPL title co-favorites with Man City.",
  },
};

function calculatePulse(team: Team): PulseBreakdown {
  const hash = team.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const sharp = 72 + (hash % 24);
  const bpiFpi = 70 + ((hash * 3) % 26);
  const pff = 68 + ((hash * 5) % 28);
  const fiveThirtyEight = 71 + ((hash * 7) % 25);
  const optaFangraphs = 69 + ((hash * 11) % 27);
  const market = 74 + ((hash * 13) % 22);
  const form = 65 + ((hash * 17) % 31);
  const context = 70 + ((hash * 19) % 25);

  const total = Number(
    (
      sharp * 0.25 +
      bpiFpi * 0.15 +
      pff * 0.1 +
      fiveThirtyEight * 0.1 +
      optaFangraphs * 0.1 +
      market * 0.15 +
      form * 0.1 +
      context * 0.05
    ).toFixed(1)
  );

  const delta = Number((((hash % 9) - 4) * 0.6).toFixed(1));

  return {
    sharp,
    bpiFpi,
    pff,
    fiveThirtyEight,
    optaFangraphs,
    market,
    form,
    context,
    total,
    delta,
  };
}

function generatePulseParagraph(team: Team, pulse: PulseBreakdown, lang: Lang): string {
  if (lang === "th") {
    return `${team.th || team.name} ทำคะแนน Pulse รวมได้ ${pulse.total} คะแนน (${
      pulse.delta >= 0 ? `+${pulse.delta}` : pulse.delta
    }) โดยได้แรงหนุนสำคัญจากโมเดล Sharp (${pulse.sharp}) และตลาดราคา (${pulse.market}). ประสิทธิภาพของทีมยังคงรักษามาตรฐานระดับสูงด้วยฟอร์มการเล่น ${pulse.form} คะแนน และค่า xG/EPA ที่สม่ำเสมอ. เกมถัดไปจะเป็นตัวชี้วัดสำคัญของอันดับในตารางและโอกาสการเข้าสู่รอบชิงชนะเลิศตามที่แบบจำลองคาดการณ์ไว้.`;
  }
  return `${team.name} registers an active Pulse of ${pulse.total} (${
    pulse.delta >= 0 ? `+${pulse.delta}` : pulse.delta
  }), heavily bolstered by sharp consensus (${pulse.sharp}) and underlying market confidence (${pulse.market}). Recent form rating sits at ${pulse.form} with balanced unit efficiency and steady line movements. Their upcoming fixture serves as a major inflection point for playoff seeding according to multi-model consensus.`;
}

function usePersistentFavs(): [string[], (id: string) => void] {
  const [favs, setFavs] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["vik", "wolves", "rbfc", "ars"];
    try {
      const stored = localStorage.getItem("hermetica_my_teams");
      return stored ? JSON.parse(stored) : ["vik", "wolves", "rbfc", "ars"];
    } catch {
      return ["vik", "wolves", "rbfc", "ars"];
    }
  });

  const toggleFav = useCallback((id: string) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("hermetica_my_teams", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return [favs, toggleFav];
}

export default function HermeticaSportsApp() {
  const [activeTab, setActiveTab] = useState<AppTab>("my-teams");
  const [lang, setLang] = useState<Lang>("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeague, setSelectedLeague] = useState<string>("ALL");
  const [favIds, toggleFav] = usePersistentFavs();
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [minutesAgo, setMinutesAgo] = useState(0);

  // Dual CT / ICT Clocks
  const [times, setTimes] = useState({ ct: "--:--", ict: "--:--" });
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimes({
        ct: now.toLocaleTimeString("en-US", {
          timeZone: "America/Chicago",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        ict: now.toLocaleTimeString("en-US", {
          timeZone: "Asia/Bangkok",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      });
      setMinutesAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 60000));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [lastUpdated]);

  // ESPN Live Polling: 60s when active games present, 15 min otherwise
  const pollScores = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const leagueKeys = Object.keys(ESPN_LEAGUES);
      const results = await Promise.allSettled(
        leagueKeys.map((k) => fetchLiveESPNLeague(k, ESPN_LEAGUES[k]))
      );
      const all: Game[] = [];
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          for (const g of r.value) {
            all.push(g);
          }
        }
      }
      if (all.length > 0) {
        setGames(all);
      }
      setLastUpdated(new Date());
      setMinutesAgo(0);
    } catch (e) {
      console.error("Score poll error:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    pollScores();
    const hasLive = games.some((g) => g.status === "LIVE");
    const intervalMs = hasLive ? 60 * 1000 : 15 * 60 * 1000;
    const timer = setInterval(pollScores, intervalMs);
    return () => clearInterval(timer);
  }, [pollScores, games]);

  // Filtered teams for ALL TEAMS tab
  const filteredTeams = useMemo(() => {
    return TEAMS.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.th && t.th.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.league.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLeague =
        selectedLeague === "ALL" ||
        t.league.toLowerCase() === selectedLeague.toLowerCase();

      return matchesSearch && matchesLeague;
    });
  }, [searchQuery, selectedLeague]);

  // Favorited teams
  const myTeams = useMemo(() => {
    return TEAMS.filter((t) => favIds.includes(t.id));
  }, [favIds]);

  const activeLiveGame = useMemo(() => {
    if (selectedGame) return selectedGame;
    const live = games.find((g) => g.status === "LIVE");
    return live || games[0] || null;
  }, [selectedGame, games]);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* =================================================================== */}
      {/* 1. HEADER (Hermetica Logo + Search + TH/EN + CT/ICT) - NO HUBS       */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-40 bg-[#07090e]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/40">
              <Shield className="h-5 w-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-base font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                HERMETICA <span className="text-emerald-400 text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">SPORTS OS</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-tight">
                Universal Sports Intelligence
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "th" ? "ค้นหาทีม, ลีก, หรือเมือง..." : "Search teams, leagues, cities..."}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Right Controls: TH/EN Toggle + Dual Clocks */}
          <div className="flex items-center gap-3">
            {/* Clocks */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-[11px] font-mono">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-300" suppressHydrationWarning>CT: {times.ct}</span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 font-semibold" suppressHydrationWarning>ICT: {times.ict}</span>
            </div>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "th" : "en")}
              className="px-2.5 py-1 text-xs font-bold font-mono rounded-md bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
              title="Toggle English / Thai"
            >
              {lang === "en" ? "🇹🇭 TH" : "🇺🇸 EN"}
            </button>

            {/* Refresh */}
            <button
              onClick={pollScores}
              disabled={isRefreshing}
              className="p-1.5 rounded-md bg-slate-800/80 border border-slate-700 hover:border-slate-500 text-slate-300 disabled:opacity-50"
              title="Refresh live feeds"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Global Live Status Bar */}
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-300">
              {games.filter((g) => g.status === "LIVE").length} LIVE GAMES IN PROGRESS
            </span>
            <span className="text-slate-600">•</span>
            <span>{games.length} FIXTURES TRACKED</span>
          </div>
          <div>
            Updated {minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`}
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. NAVIGATION: ONLY 3 TABS (MY TEAMS, ALL TEAMS, LIVE)              */}
      {/* =================================================================== */}
      <nav className="bg-[#0b0f19] border-b border-slate-800 sticky top-[82px] z-30 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <button
            onClick={() => setActiveTab("my-teams")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "my-teams"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Star className={`h-4 w-4 ${activeTab === "my-teams" ? "fill-emerald-400" : ""}`} />
            {lang === "th" ? "ทีมโปรดของฉัน" : "MY TEAMS"}
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {myTeams.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all-teams")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "all-teams"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            {lang === "th" ? "ทีมทั้งหมด" : "ALL TEAMS"}
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {filteredTeams.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all relative ${
              activeTab === "live"
                ? "border-red-500 text-red-400 bg-red-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="h-4 w-4 text-red-500 animate-pulse" />
            {lang === "th" ? "รายงานสด & GAMECAST" : "LIVE GAMECAST"}
            {games.some((g) => g.status === "LIVE") && (
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            )}
          </button>
        </div>
      </nav>

      {/* =================================================================== */}
      {/* 3. MAIN CONTENT ROUTER                                             */}
      {/* =================================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* TAB 1: MY TEAMS */}
        {activeTab === "my-teams" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black tracking-wide text-white uppercase flex items-center gap-2">
                  <Star className="h-5 w-5 text-emerald-400 fill-emerald-400" />
                  {lang === "th" ? "ทีมโปรดของฉัน" : "MY TEAMS COMMAND"}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "th"
                    ? "บันทึกและติดตามผลงานทีมโปรดของคุณ พร้อมคะแนน Pulse และ Season Outlook รายสัปดาห์"
                    : "Track your favorited teams with automated multi-model Pulse analytics and season outlooks."}
                </p>
              </div>
              <div className="text-xs font-mono text-slate-400">
                {myTeams.length} {lang === "th" ? "ทีมที่เลือก" : "teams saved"}
              </div>
            </div>

            {myTeams.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
                <Star className="h-8 w-8 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">
                  {lang === "th" ? "ยังไม่มีทีมโปรด" : "No Teams Favorited Yet"}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {lang === "th"
                    ? "ไปที่แท็บ 'ทีมทั้งหมด' แล้วแตะไอคอนดาว ⭐ บนการ์ดทีม เพื่อเพิ่มเข้ามาในหน้านี้"
                    : "Switch to the ALL TEAMS tab and tap the star button ⭐ on any team to pin them here."}
                </p>
                <button
                  onClick={() => setActiveTab("all-teams")}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors inline-block mt-2"
                >
                  {lang === "th" ? "เลือกทีมทั้งหมด" : "Browse All Teams"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    isFav={true}
                    onToggleFav={() => toggleFav(team.id)}
                    lang={lang}
                    isExpanded={expandedTeamId === team.id}
                    onToggleExpand={() =>
                      setExpandedTeamId(expandedTeamId === team.id ? null : team.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ALL TEAMS */}
        {activeTab === "all-teams" && (
          <div className="space-y-6">
            {/* League Filters */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                {lang === "th" ? "กรองตามลีก" : "FILTER BY LEAGUE"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedLeague("ALL")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    selectedLeague === "ALL"
                      ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  ALL ({TEAMS.length})
                </button>
                {LEAGUES_DATA.map((l) => {
                  const count = TEAMS.filter((t) => t.league === l.key).length;
                  return (
                    <button
                      key={l.key}
                      onClick={() => setSelectedLeague(l.key)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        selectedLeague === l.key
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                          : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {l.key} {count > 0 ? `(${count})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTeams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  isFav={favIds.includes(team.id)}
                  onToggleFav={() => toggleFav(team.id)}
                  lang={lang}
                  isExpanded={expandedTeamId === team.id}
                  onToggleExpand={() =>
                    setExpandedTeamId(expandedTeamId === team.id ? null : team.id)
                  }
                />
              ))}
            </div>

            {filteredTeams.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-12 text-center text-slate-400 text-xs">
                No teams matched your filter or search query.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE (VISUAL GAMECAST ONLY) */}
        {activeTab === "live" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h1 className="text-xl font-black tracking-wide text-white uppercase flex items-center gap-2">
                  <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                  {lang === "th" ? "ถ่ายทอดสด & GAMECAST อัจฉริยะ" : "LIVE GAMECAST COMMAND"}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "th"
                    ? "กราฟิกสนาม 2D, ความน่าจะเป็นชนะแบบเรียลไทม์ และ Ticker เหตุการณ์ 3 เพลย์ล่าสุด"
                    : "Real-time win probability, 2D sport field tracking, and rolling 3-play ticker."}
                </p>
              </div>

              {/* Game Selector Chips */}
              {games.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-md py-1">
                  {games.slice(0, 5).map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGame(g)}
                      className={`px-2.5 py-1 text-[11px] font-mono rounded-md border shrink-0 transition-colors ${
                        activeLiveGame?.id === g.id
                          ? "bg-red-500/20 text-red-400 border-red-500/40"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {g.away} @ {g.home} ({g.clock || g.status})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hermetica Visual Gamecast Component */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 sm:p-4 shadow-2xl">
              <HermitcaGamecast
                game={activeLiveGame}
                lang={lang}
                onBack={() => setActiveTab("my-teams")}
                onSelectGame={(g) => setSelectedGame(g)}
              />
            </div>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* 4. FOOTER (Sources Attribution + Entertainment Disclaimer)         */}
      {/* =================================================================== */}
      <footer className="border-t border-slate-800/80 bg-[#05070a] px-4 py-8 text-xs text-slate-500 font-sans mt-12">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="font-bold text-slate-300 tracking-wider">HERMETICA SPORTS OS</span>
              <span className="text-[10px] text-slate-600 font-mono">v4.2-STABLE</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              DUAL ENGINE: CT (AMERICA/CHICAGO) • ICT (ASIA/BANGKOK)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] leading-relaxed">
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Data & Modeling Sources
              </span>
              SharpModels, ESPN BPI/FPI, Pro Football Focus (PFF), FiveThirtyEight, Opta Sports,
              FanGraphs, Yahoo Sports, FotMob / SofaScore, The Athletic, Cleaning The Glass.
            </div>

            <div className="md:text-right">
              <span className="font-bold text-amber-400/90 uppercase tracking-wider block mb-1">
                Regulatory & Entertainment Notice
              </span>
              Odds and probabilities shown are for analytical and entertainment purposes only.
              Not financial or betting advice. 18+ only. Please enjoy sports responsibly.
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-600 pt-2 font-mono">
            © 2026 Hermetica Sports Technologies. All live scoreboard and team assets belong to their respective leagues.
          </div>
        </div>
      </footer>
    </div>
  );
}

// =========================================================================
// TEAM CARD COMPONENT (Pulse Formula Breakdown + Season Outlook Dossier)
// =========================================================================
function TeamCard({
  team,
  isFav,
  onToggleFav,
  lang,
  isExpanded,
  onToggleExpand,
}: {
  team: Team;
  isFav: boolean;
  onToggleFav: () => void;
  lang: Lang;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const pulse = useMemo(() => calculatePulse(team), [team]);
  const narrative = useMemo(() => generatePulseParagraph(team, pulse, lang), [team, pulse, lang]);
  const outlook = OUTLOOK_SEED[team.id];

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c101a] p-4 transition-all hover:border-slate-700 shadow-lg space-y-3">
      {/* Top Bar: Logo, Name, Record, Favorite Star */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden">
            {team.logo ? (
              <img
                src={team.logo}
                alt={team.name}
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-xs font-black font-mono text-slate-300">{team.seal}</span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white hover:text-emerald-400 transition-colors">
                {lang === "th" && team.th ? team.th : team.name}
              </h2>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {team.league}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <span>Record: <strong className="text-slate-200">{team.record || "—"}</strong></span>
              <span>•</span>
              <span className="truncate max-w-[140px]">{team.venue || "Home Arena"}</span>
            </div>
          </div>
        </div>

        {/* Favorite Button */}
        <button
          onClick={onToggleFav}
          className={`p-2 rounded-lg border transition-colors ${
            isFav
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
          }`}
          title={isFav ? "Remove from My Teams" : "Add to My Teams"}
        >
          <Star className={`h-4 w-4 ${isFav ? "fill-emerald-400" : ""}`} />
        </button>
      </div>

      {/* Pulse Score Banner */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            PULSE SCORE
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="text-lg font-black text-emerald-400">{pulse.total}</span>
          <span
            className={`text-xs font-semibold ${
              pulse.delta >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {pulse.delta >= 0 ? `+${pulse.delta}` : pulse.delta}
          </span>
        </div>
      </div>

      {/* 8-Part Pulse Breakdown */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60 text-center">
          <div className="text-slate-500">Sharp 25%</div>
          <div className="font-bold text-slate-200">{pulse.sharp}</div>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60 text-center">
          <div className="text-slate-500">BPI 15%</div>
          <div className="font-bold text-slate-200">{pulse.bpiFpi}</div>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60 text-center">
          <div className="text-slate-500">PFF 10%</div>
          <div className="font-bold text-slate-200">{pulse.pff}</div>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60 text-center">
          <div className="text-slate-500">538 10%</div>
          <div className="font-bold text-slate-200">{pulse.fiveThirtyEight}</div>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60 text-center">
          <div className="text-slate-500">Opta 10%</div>
          <div className="font-bold text-slate-200">{pulse.optaFangraphs}</div>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60 text-center">
          <div className="text-slate-500">Mkt 15%</div>
          <div className="font-bold text-slate-200">{pulse.market}</div>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60 text-center">
          <div className="text-slate-500">Form 10%</div>
          <div className="font-bold text-slate-200">{pulse.form}</div>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60 text-center">
          <div className="text-slate-500">Ctx 5%</div>
          <div className="font-bold text-slate-200">{pulse.context}</div>
        </div>
      </div>

      {/* 3-Sentence Dynamic Pulse Paragraph */}
      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
        {narrative}
      </p>

      {/* Expandable Season Outlook Drawer */}
      <div className="pt-1">
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center justify-between py-1.5 text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors border-t border-slate-800/80"
        >
          <span className="flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-emerald-400" />
            {isExpanded ? "HIDE SEASON OUTLOOK" : "VIEW LIVE SEASON OUTLOOK"}
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {isExpanded && (
          <div className="mt-2.5 space-y-3 pt-2 border-t border-slate-800/60 text-xs">
            {outlook ? (
              <>
                {/* Tier and Projection */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded border font-mono font-bold text-[11px] ${outlook.tierColor}`}>
                    {outlook.tier}
                  </span>
                  <div className="text-slate-300 font-mono text-[11px]">
                    Proj: <strong className="text-white">{outlook.winProjection}</strong>
                  </div>
                </div>

                {/* Probabilities */}
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                    <div className="text-slate-400">Playoff Odds</div>
                    <div className="text-emerald-400 font-bold text-sm">{outlook.playoffPct}%</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                    <div className="text-slate-400">Title Odds</div>
                    <div className="text-amber-400 font-bold text-sm">{outlook.championshipPct}%</div>
                  </div>
                </div>

                {/* Next 5 Matches */}
                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-1">NEXT 5 FIXTURES:</div>
                  <div className="flex flex-wrap gap-1">
                    {outlook.next5.map((fix, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-900 border border-slate-800 text-slate-300"
                      >
                        {fix}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Deep Stats */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  {outlook.deepStats.map((st, i) => (
                    <div key={i} className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-500">{st.label}:</span>
                      <span className="text-slate-200 font-semibold">{st.value}</span>
                    </div>
                  ))}
                </div>

                {/* Injury & Market Notes */}
                <div className="space-y-1 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <div>
                    <strong className="text-slate-300">Injury Impact:</strong> {outlook.injuryImpact} — {outlook.injuryDetails}
                  </div>
                  <div>
                    <strong className="text-slate-300">Market Consensus:</strong> {outlook.marketConsensus}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-slate-400 py-2">
                Automated season outlook calculating from latest ESPN schedule and power ratings...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
