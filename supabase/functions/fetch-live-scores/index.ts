import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sports endpoints mapped to ESPN API routes
const ESPN_LEAGUES: Record<string, { sport: string; endpoint: string }> = {
  NFL: { sport: "Football", endpoint: "football/nfl" },
  NBA: { sport: "Basketball", endpoint: "basketball/nba" },
  NHL: { sport: "Hockey", endpoint: "hockey/nhl" },
  MLB: { sport: "Baseball", endpoint: "baseball/mlb" },
  WNBA: { sport: "Basketball", endpoint: "basketball/wnba" },
  MLS: { sport: "Soccer", endpoint: "soccer/usa.1" },
  PL: { sport: "Soccer", endpoint: "soccer/eng.1" },
  LaLiga: { sport: "Soccer", endpoint: "soccer/esp.1" },
  "Thai League 1": { sport: "Soccer", endpoint: "soccer/tha.1" },
};

// Known core hub teams map
const HUB_TEAM_ALIASES: Record<string, string> = {
  min: "vik",
  vikings: "vik",
  timberwolves: "wolves",
  wild: "wild",
  twins: "twins",
  lynx: "lynx",
  frost: "frost",
  "minnesota united": "mnufc",
  ratchaburi: "rbfc",
};

interface PulseWeights {
  sharp: number;        // 25%
  bpi_fpi: number;      // 15%
  pff: number;          // 10%
  five_thirty_eight: number; // 10%
  opta_fangraphs: number;    // 10%
  market: number;       // 15%
  form: number;         // 10%
  context: number;      // 5%
}

// =========================================================================
// RECALCULATE PULSE FORMULA
// Pulse = Sharp 25% + BPI/FPI 15% + PFF 10% + 538 10% + Opta 10% + Market 15% + Form 10% + Context 5%
// =========================================================================
function computePulse(
  metrics: PulseWeights
): { score: number; trend: "surging" | "steady" | "cooling" | "critical" } {
  const score = Number(
    (
      metrics.sharp * 0.25 +
      metrics.bpi_fpi * 0.15 +
      metrics.pff * 0.10 +
      metrics.five_thirty_eight * 0.10 +
      metrics.opta_fangraphs * 0.10 +
      metrics.market * 0.15 +
      metrics.form * 0.10 +
      metrics.context * 0.05
    ).toFixed(2)
  );

  let trend: "surging" | "steady" | "cooling" | "critical" = "steady";
  if (score >= 82) trend = "surging";
  else if (score >= 60) trend = "steady";
  else if (score >= 45) trend = "cooling";
  else trend = "critical";

  return { score, trend };
}

// Generate bilingual narrative after game goes FINAL
function generateFinalPulseParagraph(
  teamName: string,
  teamTh: string,
  isWinner: boolean,
  myScore: number,
  oppScore: number,
  oppName: string,
  newPulse: number,
  league: string
): { en: string; th: string } {
  const diff = Math.abs(myScore - oppScore);

  if (isWinner) {
    return {
      en: `${teamName} secured a commanding ${myScore}-${oppScore} victory against ${oppName}. Their composite rating surges to ${newPulse.toFixed(
        1
      )} following a dominant performance that moved the needle across Sharp money and performance metrics. Championship leverage is elevating as their form rating sits near season highs.`,
      th: `${teamTh} คว้าชัยชนะครั้งสำคัญด้วยสกอร์ ${myScore}-${oppScore} เหนือ ${oppName} ส่งผลให้คะแนนประเมินศักยภาพ Pulse พุ่งขึ้นมาอยู่ที่ ${newPulse.toFixed(
        1
      )} จากฟอร์มการเล่นที่แข็งแกร่งและสถิติเชิงลึกที่เหนือกว่า โอกาสในการลุ้นแชมป์ ${league} สดใสยิ่งขึ้น`,
    };
  } else {
    return {
      en: `${teamName} suffered a ${myScore}-${oppScore} setback against ${oppName}. The loss drags their composite Pulse to ${newPulse.toFixed(
        1
      )}, reflecting pressure on their Opta/PFF efficiency ratings and narrowing their safety margin in the standings. Tactical adjustments are required heading into the next fixture.`,
      th: `${teamTh} พ่ายแพ้ต่อ ${oppName} ไปด้วยสกอร์ ${myScore}-${oppScore} ทำให้คะแนนประเมินความพร้อมลดลงมาอยู่ที่ ${newPulse.toFixed(
        1
      )} ส่งผลกระทบต่อสถิติตารางคะแนนโดยรวมในลีก ${league} และจำเป็นต้องปรับแท็กติกเพื่อกู้ฟอร์มในเกมนัดถัดไป`,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");

    const leagueKeys = Object.keys(ESPN_LEAGUES);
    const summaryLog = {
      processedLeagues: 0,
      upsertedGames: 0,
      updatedFinals: 0,
      pulseRecalculated: 0,
    };

    for (const lKey of leagueKeys) {
      const config = ESPN_LEAGUES[lKey];
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.endpoint}/scoreboard?dates=${dateStr}`;

      try {
        const res = await fetch(espnUrl, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) continue;
        const data = await res.json();
        const events = data.events || [];
        summaryLog.processedLeagues++;

        for (const ev of events) {
          const comp = ev.competitions?.[0];
          if (!comp) continue;

          const homeComp = comp.competitors?.find((c: any) => c.homeAway === "home");
          const awayComp = comp.competitors?.find((c: any) => c.homeAway === "away");
          if (!homeComp || !awayComp) continue;

          const homeScore = parseInt(homeComp.score || "0", 10);
          const awayScore = parseInt(awayComp.score || "0", 10);
          const statusState = ev.status?.type?.state; // "pre" | "in" | "post"
          const isCompleted = ev.status?.type?.completed === true;

          const gameStatus: "LIVE" | "FINAL" | "UPCOMING" =
            statusState === "in" ? "LIVE" : statusState === "post" || isCompleted ? "FINAL" : "UPCOMING";

          const clock =
            gameStatus === "LIVE"
              ? ev.status?.displayClock || `${ev.status?.period || 1}Q`
              : gameStatus === "FINAL"
              ? "FINAL"
              : new Date(ev.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          // Resolve internal team ID or create slug
          const homeAlias =
            HUB_TEAM_ALIASES[homeComp.team.abbreviation?.toLowerCase()] ||
            HUB_TEAM_ALIASES[homeComp.team.name?.toLowerCase()] ||
            `espn-${homeComp.id}`;
          const awayAlias =
            HUB_TEAM_ALIASES[awayComp.team.abbreviation?.toLowerCase()] ||
            HUB_TEAM_ALIASES[awayComp.team.name?.toLowerCase()] ||
            `espn-${awayComp.id}`;

          // Upsert teams
          await supabase.from("teams").upsert(
            [
              {
                id: homeAlias,
                espn_id: homeComp.id,
                name: homeComp.team.displayName || homeComp.team.name,
                th: homeComp.team.displayName || homeComp.team.name,
                seal: homeComp.team.abbreviation || "HM",
                league: lKey,
                sport: config.sport,
                record: homeComp.records?.[0]?.summary || "0-0",
                logo: homeComp.team.logo || homeComp.team.logos?.[0]?.href,
                updated_at: new Date().toISOString(),
              },
              {
                id: awayAlias,
                espn_id: awayComp.id,
                name: awayComp.team.displayName || awayComp.team.name,
                th: awayComp.team.displayName || awayComp.team.name,
                seal: awayComp.team.abbreviation || "AW",
                league: lKey,
                sport: config.sport,
                record: awayComp.records?.[0]?.summary || "0-0",
                logo: awayComp.team.logo || awayComp.team.logos?.[0]?.href,
                updated_at: new Date().toISOString(),
              },
            ],
            { onConflict: "id" }
          );

          // Check previous state for game to detect newly completed games
          const { data: existingGame } = await supabase
            .from("games")
            .select("status, home_score, away_score")
            .eq("espn_id", ev.id)
            .single();

          const justFinished = existingGame && existingGame.status !== "FINAL" && gameStatus === "FINAL";

          // Upsert game record
          const gameId = `espn-${ev.id}`;
          await supabase.from("games").upsert(
            {
              id: gameId,
              espn_id: ev.id,
              league: lKey,
              sport: config.sport,
              home_team_id: homeAlias,
              away_team_id: awayAlias,
              home_team_name: homeComp.team.displayName,
              away_team_name: awayComp.team.displayName,
              home_score: homeScore,
              away_score: awayScore,
              status: gameStatus,
              clock: clock,
              period: String(ev.status?.period || "—"),
              kickoff: ev.date,
              venue: comp.venue?.fullName || "Stadium",
              odds: comp.odds?.[0]?.details || "—",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "espn_id" }
          );
          summaryLog.upsertedGames++;

          // If game just finished or is FINAL, calculate formula and update paragraph
          if (justFinished || gameStatus === "FINAL") {
            const homeWon = homeScore > awayScore;
            const teamsToProcess = [
              { id: homeAlias, name: homeComp.team.displayName, won: homeWon, myS: homeScore, oppS: awayScore, oppName: awayComp.team.displayName },
              { id: awayAlias, name: awayComp.team.displayName, won: !homeWon, myS: awayScore, oppS: homeScore, oppName: homeComp.team.displayName },
            ];

            for (const t of teamsToProcess) {
              // Deterministic ratings derived from box score and game context
              const baseRating = t.won ? 75 : 48;
              const marginBoost = Math.min(15, Math.abs(t.myS - t.oppS) * 1.5);
              
              const metrics: PulseWeights = {
                sharp: Number(Math.min(99, Math.max(20, baseRating + (t.won ? marginBoost : -marginBoost))).toFixed(1)),
                bpi_fpi: Number(Math.min(99, Math.max(20, baseRating + (t.won ? 5 : -5))).toFixed(1)),
                pff: Number(Math.min(99, Math.max(20, baseRating + (t.myS > 20 ? 8 : -4))).toFixed(1)),
                five_thirty_eight: Number(Math.min(99, Math.max(20, baseRating + (t.won ? 6 : -6))).toFixed(1)),
                opta_fangraphs: Number(Math.min(99, Math.max(20, baseRating + (t.won ? 7 : -7))).toFixed(1)),
                market: Number(Math.min(99, Math.max(20, baseRating + 2)).toFixed(1)),
                form: Number(Math.min(99, Math.max(20, t.won ? 88 : 42)).toFixed(1)),
                context: Number(Math.min(99, Math.max(20, baseRating + 4)).toFixed(1)),
              };

              const { score: newPulse, trend: newTrend } = computePulse(metrics);
              const newParagraph = generateFinalPulseParagraph(
                t.name,
                t.name,
                t.won,
                t.myS,
                t.oppS,
                t.oppName,
                newPulse,
                lKey
              );

              // 1. Insert snapshot into ratings_history
              await supabase.from("ratings_history").insert({
                team_id: t.id,
                game_id: gameId,
                sharp_rating: metrics.sharp,
                bpi_fpi_rating: metrics.bpi_fpi,
                pff_rating: metrics.pff,
                five_thirty_eight: metrics.five_thirty_eight,
                opta_fangraphs: metrics.opta_fangraphs,
                market_rating: metrics.market,
                form_rating: metrics.form,
                context_rating: metrics.context,
                calculated_pulse: newPulse,
                pulse_paragraph: newParagraph,
              });

              // 2. Update team's live pulse score and paragraph
              await supabase
                .from("teams")
                .update({
                  pulse_score: newPulse,
                  pulse_trend: newTrend,
                  pulse_paragraph: newParagraph,
                  last_game_id: gameId,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", t.id);

              summaryLog.pulseRecalculated++;
            }
            summaryLog.updatedFinals++;
          }
        }
      } catch (err) {
        console.error(`Error processing league ${lKey}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, timestamp: now.toISOString(), ...summaryLog }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
