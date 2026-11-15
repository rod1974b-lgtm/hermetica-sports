// =========================================================================
// PART 1 OF 5: Lines 1 - 347 of src/routes/index.tsx
// =========================================================================

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Hub,
  Lang,
  Team,
  Game,
  SPORTS_THEMES,
  TEAMS,
  LEAGUES,
  MN_IDS,
  T,
  teamById,
  fmtTime,
} from "@/lib/sports-data";
import {
  fetchLiveESPNLeague,
  ESPN_LEAGUES,
  fetchDualWeather,
  UPCOMING_HUB_FIXTURES,
} from "@/lib/live-sports-api";
import { HermitcaGamecast } from "@/components/HermitcaGamecast";
import {
  Radio,
  Star,
  Compass,
  Trophy,
  Sparkles,
  Flame,
  Search,
  Calendar,
  Share2,
  TrendingUp,
  RotateCcw,
  Clock,
  MapPin,
  ChevronRight,
  Shield,
  Activity,
  Award,
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Target,
  BarChart3,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    title: "Hermetica Sports OS | Ratchaburi & Minnesota Twin Cities Live Sports",
    meta: [
      {
        name: "description",
        content:
          "Bilingual real-time Sports OS tracking Ratchaburi FC, all 7 Minnesota professional teams (Vikings, Timberwolves, Twins, Wild, Lynx, Frost, MNUFC), and global leagues with live scores, momentum radar, and year-round team pulse.",
      },
      {
        property: "og:title",
        content: "Hermetica Sports OS | Global & Hub Sports Command Center",
      },
      {
        property: "og:description",
        content:
          "Real-time dual-timezone sports tracking for Dragon Solar Park, Minnesota Twin Cities, and 14 international leagues.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

// =========================================================================
// DATA MODELS & SEASON OUTLOOK
// =========================================================================

export type AppTab =
  | "live"
  | "pulse"
  | "my"
  | "seasons"
  | "explore"
  | "leagues"
  | "fantasy";

export type SeasonPhase =
  | "preseason"
  | "regular"
  | "playoffs"
  | "championship"
  | "offseason";

export interface KeyDate {
  date: string;
  label: { en: string; th: string };
  phase: SeasonPhase;
  highlight?: boolean;
}

export interface SeasonOutlook {
  teamId: string;
  seasonYear: string;
  currentPhase: SeasonPhase;
  phaseLabel: { en: string; th: string };
  summary: { en: string; th: string };
  keyDates: KeyDate[];
  playoffOdds?: string;
  championshipOdds?: string;
  projectedRecord?: string;
  milestones?: { en: string; th: string }[];
}

export const SEASON_OUTLOOKS: Record<string, SeasonOutlook> = {
  vik: {
    teamId: "vik",
    seasonYear: "2026-27",
    currentPhase: "regular",
    phaseLabel: { en: "Regular Season", th: "ฤดูกาลปกติ" },
    summary: {
      en: "Following a scorching 2-0 kickoff fueled by Brian Flores' aggressive blitz scheme, the Vikings aim for the NFC North crown. With high-efficiency quarterback play and Justin Jefferson stretching coverages, Minnesota is primed for a deep January playoff run.",
      th: "ออกสตาร์ทสุดร้อนแรงด้วยสถิติ 2-0 จากแผนเกมรับบุกแหลกของ ไบรอัน ฟลอเรส มินนิโซตา ไวกิ้งส์ ตั้งเป้าล่าแชมป์กลุ่ม NFC North การขับเคลื่อนเกมรุกที่มีประสิทธิภาพร่วมกับ จัสติน เจฟเฟอร์สัน พร้อมพาทีมลุยศึกเพลย์ออฟเดือนมกราคม",
    },
    projectedRecord: "11-6",
    playoffOdds: "82%",
    championshipOdds: "+1800",
    keyDates: [
      {
        date: "2026-08-08",
        label: { en: "Training Camp & Preseason Opener", th: "เปิดแคมป์ฝึกซ้อม & พรีซีซัน" },
        phase: "preseason",
      },
      {
        date: "2026-09-10",
        label: { en: "NFL Kickoff Weekend", th: "เปิดฤดูกาลปกติ NFL" },
        phase: "regular",
        highlight: true,
      },
      {
        date: "2026-09-28",
        label: { en: "Dublin Classic @ Croke Park vs Steelers", th: "ดับลิน คลาสสิก @ โครก พาร์ก พบ สตีลเลอร์ส" },
        phase: "regular",
        highlight: true,
      },
      {
        date: "2027-01-10",
        label: { en: "Regular Season Finale", th: "นัดปิดฤดูกาลปกติ" },
        phase: "regular",
      },
      {
        date: "2027-01-16",
        label: { en: "NFL Wild Card Weekend", th: "รอบไวลด์การ์ด NFL" },
        phase: "playoffs",
      },
      {
        date: "2027-02-14",
        label: { en: "Super Bowl LXI", th: "ซูเปอร์โบวล์ ครั้งที่ 61" },
        phase: "championship",
        highlight: true,
      },
      {
        date: "2027-03-15",
        label: { en: "NFL Free Agency & Draft Prep", th: "ตลาดฟรีเอเยนต์ & เตรียมการดราฟต์" },
        phase: "offseason",
      },
    ],
    milestones: [
      { en: "Top-5 NFL Scoring Defense ranking", th: "อันดับท็อป 5 เกมรับเสียแต้มน้อยที่สุดใน NFL" },
      { en: "Over 1,400 receiving yards projected for WR1", th: "เป้าหมายรับบอลทะลุ 1,400 หลาของปีกเบอร์ 1" },
    ],
  },
  wolves: {
    teamId: "wolves",
    seasonYear: "2026-27",
    currentPhase: "preseason",
    phaseLabel: { en: "Preseason / Training Camp", th: "พรีซีซัน & เทรนนิ่งแคมป์" },
    summary: {
      en: "Anthony Edwards steps into MVP contention surrounded by Rudy Gobert's interior deterrence and an upgraded perimeter arsenal. After deep Western Conference Finals runs, the target is the NBA Finals stage.",
      th: "แอนโทนี เอ็ดเวิร์ดส์ ก้าวสู่แคนดิเดต MVP เต็มตัว ผนึกกำลังกับเกมป้องกันวงในของ รูดี โกแบร์ หลังเข้าชิงแชมป์สายตะวันตก เป้าหมายเดียวคือการคว้าตั๋วเข้าสู่ NBA ไฟนอลส์",
    },
    projectedRecord: "53-29",
    playoffOdds: "91%",
    championshipOdds: "+950",
    keyDates: [
      {
        date: "2026-10-02",
        label: { en: "NBA Preseason Tip-off @ Target Center", th: "เปิดศึกพรีซีซัน @ ทาร์เก็ต เซ็นเตอร์" },
        phase: "preseason",
      },
      {
        date: "2026-10-22",
        label: { en: "Regular Season Home Opener", th: "เปิดฤดูกาลปกติเกมแรกในบ้าน" },
        phase: "regular",
        highlight: true,
      },
      {
        date: "2026-12-15",
        label: { en: "NBA Emirates Cup Knockouts", th: "เอมิเรตส์ เอ็นบีเอ คัพ รอบน็อกเอาต์" },
        phase: "regular",
      },
      {
        date: "2027-04-18",
        label: { en: "NBA Playoffs Round 1", th: "เปิดศึก NBA เพลย์ออฟ รอบแรก" },
        phase: "playoffs",
        highlight: true,
      },
      {
        date: "2027-06-03",
        label: { en: "NBA Finals Game 1", th: "NBA ไฟนอลส์ นัดแรก" },
        phase: "championship",
        highlight: true,
      },
      {
        date: "2027-06-25",
        label: { en: "NBA Draft & Free Agency Window", th: "งานดราฟต์ผู้เล่น & ตลาดฟรีเอเยนต์" },
        phase: "offseason",
      },
    ],
    milestones: [
      { en: "Defensive Rating ranking in league top-3", th: "เรตติ้งเกมรับติด 3 อันดับแรกของลีก" },
      { en: "Home court advantage through at least Round 2", th: "คว้าสิทธิ์เจ้าบ้านอย่างน้อยจนถึงรอบสอง" },
    ],
  },
  wild: {
    teamId: "wild",
    seasonYear: "2026-27",
    currentPhase: "regular",
    phaseLabel: { en: "Regular Season", th: "ฤดูกาลปกติ" },
    summary: {
      en: "Kaprizov and Boldy anchor one of the NHL's most dynamic scoring tandems. Freed from past buyout salary constraints, the Wild have deepened their blueline and enter the Central Division arms race as a true Stanley Cup dark horse.",
      th: "คิริลล์ คาปริซอฟ และ แมตต์ โบลดี นำทัพคู่แนวรุกอันตรายที่สุดใน NHL การพ้นเพดานค่าเหนื่อยช่วยเสริมแนวรับแกร่ง พร้อมท้าชิงแชมป์ดิวิชันเซ็นทรัลและลุ้นถ้วยสแตนลีย์คัพ",
    },
    projectedRecord: "48-25-9",
    playoffOdds: "79%",
    championshipOdds: "+2200",
    keyDates: [
      {
        date: "2026-09-21",
        label: { en: "NHL Preseason Training Camp", th: "พรีซีซัน & เทรนนิ่งแคมป์ฮอกกี้" },
        phase: "preseason",
      },
      {
        date: "2026-10-10",
        label: { en: "Home Opener vs Chicago Blackhawks", th: "เปิดบ้านพบ ชิคาโก แบล็กฮอว์กส์" },
        phase: "regular",
        highlight: true,
      },
      {
        date: "2027-01-01",
        label: { en: "NHL Winter Classic Showcase", th: "ศึกกลางแจ้ง วินเทอร์ คลาสสิก" },
        phase: "regular",
      },
      {
        date: "2027-04-14",
        label: { en: "Regular Season Conclusion", th: "ปิดฤดูกาลปกติ NHL" },
        phase: "regular",
      },
      {
        date: "2027-04-19",
        label: { en: "Stanley Cup Playoffs Begin", th: "เปิดศึกสแตนลีย์ คัพ เพลย์ออฟ" },
        phase: "playoffs",
        highlight: true,
      },
      {
        date: "2027-06-10",
        label: { en: "Stanley Cup Finals", th: "สแตนลีย์ คัพ รอบชิงชนะเลิศ" },
        phase: "championship",
        highlight: true,
      },
    ],
  },
  twins: {
    teamId: "twins",
    seasonYear: "2026",
    currentPhase: "offseason",
    phaseLabel: { en: "Offseason & Hot Stove", th: "ช่วงปิดฤดูกาล & ตลาดซื้อขาย" },
    summary: {
      en: "After a season testing young talent like Emmanuel Rodriguez and young bullpen arms, the Twins pivot toward pitching acquisitions and roster re-tooling ahead of Fort Myers Spring Training.",
      th: "หลังเปิดโอกาสให้ดาวรุ่งอย่าง เอ็มมานูเอล โรดริเกซ ฉายแวว มินนิโซตา ทวินส์ เดินหน้าเสริมพิชเชอร์และปรับโครงสร้างทีมเพื่อเตรียมความพร้อมสู่สปริงเทรนนิ่งที่ฟอร์ตไมเออร์ส",
    },
    projectedRecord: "84-78",
    playoffOdds: "48%",
    championshipOdds: "+4500",
    keyDates: [
      {
        date: "2026-11-05",
        label: { en: "MLB Free Agency & Trade Meetings", th: "เปิดตลาดฟรีเอเยนต์ & ประชุมเทรดผู้เล่น" },
        phase: "offseason",
      },
      {
        date: "2027-02-14",
        label: { en: "Pitchers & Catchers Report (Fort Myers)", th: "พิชเชอร์ & แคชเชอร์ รายงานตัวสปริงเทรนนิ่ง" },
        phase: "preseason",
        highlight: true,
      },
      {
        date: "2027-03-27",
        label: { en: "MLB Opening Day 2027", th: "วันเปิดฤดูกาลเบสบอล MLB 2027" },
        phase: "regular",
        highlight: true,
      },
      {
        date: "2027-10-01",
        label: { en: "Postseason AL Wild Card Series", th: "รอบไวลด์การ์ด อเมริกันลีก" },
        phase: "playoffs",
      },
    ],
  },
  lynx: {
    teamId: "lynx",
    seasonYear: "2026",
    currentPhase: "championship",
    phaseLabel: { en: "WNBA Finals / Title Chase", th: "รอบชิงชนะเลิศ WNBA" },
    summary: {
      en: "Led by Napheesa Collier's historic MVP-caliber season and Courtney Williams' playmaking, the Lynx sit on the precipice of securing franchise championship banner #5.",
      th: "นำโดย นาฟีซา คอลเลียร์ ที่ระเบิดฟอร์มระดับ MVP มินนิโซตา ลิงซ์ ยืนหยัดอยู่บนเส้นทางล่าแชมป์ WNBA สมัยที่ 5 ของประวัติศาสตร์สโมสร",
    },
    projectedRecord: "33-7",
    playoffOdds: "100%",
    championshipOdds: "+140",
    keyDates: [
      {
        date: "2026-05-15",
        label: { en: "WNBA Season Tip-Off", th: "เปิดฉากฤดูกาล WNBA" },
        phase: "regular",
      },
      {
        date: "2026-09-20",
        label: { en: "WNBA Playoffs Round 1", th: "เพลย์ออฟ รอบแรก" },
        phase: "playoffs",
      },
      {
        date: "2026-10-10",
        label: { en: "WNBA Finals Game 1", th: "WNBA ไฟนอลส์ นัดแรก" },
        phase: "championship",
        highlight: true,
      },
      {
        date: "2026-10-22",
        label: { en: "WNBA Trophy Presentation & Parade", th: "พิธีมอบแชมป์และขบวนพาเหรด" },
        phase: "championship",
      },
    ],
  },
