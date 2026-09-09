"use client";

import { Dispatch, SetStateAction, SyntheticEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bike, Bookmark, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, Heart, Info, LocateFixed, Share2 } from "lucide-react";
import { GearSelections } from "@/data/gearCatalog";
import FunProgressBar from "@/components/FunProgressBar";
import { AdventureEventRecord, inferDiscoveryProfile, loadAdventureEvents } from "@/lib/adventure-events";
import { GearDiscoveryItem, loadGearDiscoveryItems } from "@/lib/gear-discovery";
import { useLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ReelStyle } from "@/types";

interface RenderPanelProps {
  /** 0-1 progress. `null` while the ffmpeg.wasm engine itself is still downloading/booting. */
  progress: number | null;
  phaseLabel: string;
  styleLabel: string;
  style: ReelStyle;
  videoNames: string[];
  gearSelections: GearSelections;
}

interface SportTelemetry {
  distanceKm: number;
  durationLabel: string;
  elevationGainM: number;
  highestPointM: number | null;
  maxSpeedKmh: number | null;
}

const RENDER_DISCOVERY_COPY: Record<
  Locale,
  {
    complete: string;
    upcomingTitle: string;
    upcomingSubtitle: string;
    gearTitle: string;
    gearSubtitle: string;
    personalized: string;
    startsIn: string;
    discoverEvent: string;
    selectGearHint: string;
    newModel: string;
    brandNews: string;
    community: string;
    countdownDays: string;
    countdownHours: string;
    countdownMinutes: string;
    detailPrefix: string;
    previous: string;
    next: string;
    shareByEmail: string;
  }
> = {
  fr: {
    complete: "Terminé",
    upcomingTitle: "Aventures à venir",
    upcomingSubtitle: "Découvre ta prochaine ride pendant le rendu",
    gearTitle: "Gear & Brand News",
    gearSubtitle: "Basé sur ta Adventure Card",
    personalized: "PERSONNALISÉ",
    startsIn: "Commence dans",
    discoverEvent: "DÉCOUVRIR L'ÉVÉNEMENT",
    selectGearHint: "Sélectionne des marques/modèles dans ton Adventure Card pour débloquer l'actualité gear personnalisée.",
    newModel: "NOUVEAU MODÈLE",
    brandNews: "NEWS MARQUE",
    community: "COMMUNAUTÉ",
    countdownDays: "Jours",
    countdownHours: "Heures",
    countdownMinutes: "Minutes",
    detailPrefix: "Dernière mise à jour liée à ta sélection",
    previous: "Précédent",
    next: "Suivant",
    shareByEmail: "Partager par email",
  },
  de: {
    complete: "Fertig",
    upcomingTitle: "Bevorstehende Abenteuer",
    upcomingSubtitle: "Entdecke deinen nächsten Ride während des Renderings",
    gearTitle: "Gear & Brand News",
    gearSubtitle: "Basierend auf deiner Adventure Card",
    personalized: "PERSONALISIERT",
    startsIn: "Startet in",
    discoverEvent: "EVENT ENTDECKEN",
    selectGearHint: "Wähle Marken/Modelle in deiner Adventure Card, um personalisierte Gear-News zu sehen.",
    newModel: "NEUES MODELL",
    brandNews: "MARKEN-NEWS",
    community: "COMMUNITY",
    countdownDays: "Tage",
    countdownHours: "Stunden",
    countdownMinutes: "Minuten",
    detailPrefix: "Neueste Aktualisierung zu deiner Auswahl",
    previous: "Zurück",
    next: "Weiter",
    shareByEmail: "Per E-Mail teilen",
  },
  en: {
    complete: "Complete",
    upcomingTitle: "Upcoming Adventures",
    upcomingSubtitle: "Discover your next ride while rendering",
    gearTitle: "Gear & Brand News",
    gearSubtitle: "Updates based on your Adventure Card",
    personalized: "PERSONALIZED",
    startsIn: "Starts in",
    discoverEvent: "DISCOVER EVENT",
    selectGearHint: "Select brand/model items in your Adventure Card to unlock personalized gear news.",
    newModel: "NEW MODEL",
    brandNews: "BRAND NEWS",
    community: "COMMUNITY",
    countdownDays: "Days",
    countdownHours: "Hours",
    countdownMinutes: "Minutes",
    detailPrefix: "Latest update related to your selected setup",
    previous: "Previous",
    next: "Next",
    shareByEmail: "Share by email",
  },
  es: {
    complete: "Completado",
    upcomingTitle: "Próximas aventuras",
    upcomingSubtitle: "Descubre tu próxima ruta mientras se renderiza",
    gearTitle: "Gear & Brand News",
    gearSubtitle: "Actualizaciones basadas en tu Adventure Card",
    personalized: "PERSONALIZADO",
    startsIn: "Empieza en",
    discoverEvent: "DESCUBRIR EVENTO",
    selectGearHint: "Selecciona marcas/modelos en tu Adventure Card para desbloquear noticias de equipamiento personalizadas.",
    newModel: "NUEVO MODELO",
    brandNews: "NOTICIAS DE MARCA",
    community: "COMUNIDAD",
    countdownDays: "Días",
    countdownHours: "Horas",
    countdownMinutes: "Minutos",
    detailPrefix: "Última actualización relacionada con tu selección",
    previous: "Anterior",
    next: "Siguiente",
    shareByEmail: "Compartir por email",
  },
  it: {
    complete: "Completato",
    upcomingTitle: "Prossime avventure",
    upcomingSubtitle: "Scopri il tuo prossimo ride durante il rendering",
    gearTitle: "Gear & Brand News",
    gearSubtitle: "Aggiornamenti basati sulla tua Adventure Card",
    personalized: "PERSONALIZZATO",
    startsIn: "Inizia tra",
    discoverEvent: "SCOPRI EVENTO",
    selectGearHint: "Seleziona marca/modello nella tua Adventure Card per sbloccare news gear personalizzate.",
    newModel: "NUOVO MODELLO",
    brandNews: "NEWS BRAND",
    community: "COMMUNITY",
    countdownDays: "Giorni",
    countdownHours: "Ore",
    countdownMinutes: "Minuti",
    detailPrefix: "Ultimo aggiornamento legato alla tua selezione",
    previous: "Precedente",
    next: "Successivo",
    shareByEmail: "Condividi via email",
  },
  zh: {
    complete: "完成",
    upcomingTitle: "即将到来的冒险活动",
    upcomingSubtitle: "渲染期间发现你的下一次骑行",
    gearTitle: "Gear & Brand News",
    gearSubtitle: "基于你的 Adventure Card 的更新",
    personalized: "个性化",
    startsIn: "开始于",
    discoverEvent: "探索活动",
    selectGearHint: "在 Adventure Card 中选择品牌/型号以解锁个性化装备资讯。",
    newModel: "新车型",
    brandNews: "品牌资讯",
    community: "社区",
    countdownDays: "天",
    countdownHours: "小时",
    countdownMinutes: "分钟",
    detailPrefix: "与你已选配置相关的最新更新",
    previous: "上一项",
    next: "下一项",
    shareByEmail: "通过邮件分享",
  },
};

const SPORT_LAB_COPY: Record<Locale, { system: string; diagnostics: string; terrain: string; exposure: string; clips: string; live: string }> = {
  fr: { system: "SYSTÈME", diagnostics: "Diagnostics route", terrain: "Relief & altitude", exposure: "Panneaux éditoriaux", clips: "Sources clip", live: "Flux live" },
  de: { system: "SYSTEM", diagnostics: "Routen-Diagnostik", terrain: "Relief & Höhe", exposure: "Editorial-Panels", clips: "Clip-Quellen", live: "Live-Feed" },
  en: { system: "SYSTEM", diagnostics: "Route diagnostics", terrain: "Relief & altitude", exposure: "Editorial panels", clips: "Clip sources", live: "Live feed" },
  es: { system: "SISTEMA", diagnostics: "Diagnóstico de ruta", terrain: "Relieve y altitud", exposure: "Paneles editoriales", clips: "Fuentes de clips", live: "Feed en vivo" },
  it: { system: "SISTEMA", diagnostics: "Diagnostica percorso", terrain: "Rilievo e altitudine", exposure: "Pannelli editoriali", clips: "Sorgenti clip", live: "Feed live" },
  zh: { system: "系统", diagnostics: "路线诊断", terrain: "地形与海拔", exposure: "编辑面板", clips: "片段来源", live: "实时流" },
};

/**
 * Shown while the real ffmpeg.wasm montage (cuts + Ken Burns zoom + transitions)
 * is being rendered in the browser. Unlike `AIAnalysisPanel` (a simulated
 * timer), the progress bar here reflects real `ffmpeg.on("progress", …)`
 * events — rendering can take anywhere from a few seconds to ~a minute.
 * The lower section turns waiting time into a curated "Adventure Discovery"
 * experience with upcoming events and quick actions.
 */
export default function RenderPanel({
  progress,
  phaseLabel,
  styleLabel,
  style,
  videoNames,
  gearSelections,
}: RenderPanelProps) {
  const { copy, locale } = useLocale();
  const [events, setEvents] = useState<AdventureEventRecord[]>([]);
  const [gearNews, setGearNews] = useState<GearDiscoveryItem[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [savedGear, setSavedGear] = useState<Set<string>>(new Set());
  const [likedGear, setLikedGear] = useState<Set<string>>(new Set());
  const [expandedGear, setExpandedGear] = useState<Set<string>>(new Set());
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const [eventIndex, setEventIndex] = useState(0);
  const [gearIndex, setGearIndex] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const discoveryProfile = useMemo(
    () => inferDiscoveryProfile(style, videoNames),
    [style, videoNames]
  );

  useEffect(() => {
    let cancelled = false;
    void loadAdventureEvents(discoveryProfile).then((items) => {
      if (!cancelled) setEvents(items);
    }).catch((error) => {
      console.error("[RenderPanel] adventure events loading failed", error);
      if (!cancelled) setEvents([]);
    });
    return () => {
      cancelled = true;
    };
  }, [discoveryProfile]);

  useEffect(() => {
    let cancelled = false;
    void loadGearDiscoveryItems(gearSelections).then((items) => {
      if (!cancelled) setGearNews(items);
    }).catch((error) => {
      console.error("[RenderPanel] gear discovery loading failed", error);
      if (!cancelled) setGearNews([]);
    });
    return () => {
      cancelled = true;
    };
  }, [gearSelections]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);

  const percent = progress === null ? 0 : Math.round(progress * 100);
  const discoveryCopy = RENDER_DISCOVERY_COPY[locale];
  const sportCopy = SPORT_LAB_COPY[locale];
  const featuredEvent = events[Math.min(eventIndex, Math.max(events.length - 1, 0))] ?? null;
  const featuredGear = gearNews[Math.min(gearIndex, Math.max(gearNews.length - 1, 0))] ?? null;

  const toggleSet = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markLogoFailed = (eventId: string) => {
    setFailedLogos((current) => {
      const next = new Set(current);
      next.add(eventId);
      return next;
    });
  };

  const cycleStory = (target: "events" | "gear", direction: -1 | 1) => {
    if (target === "events") {
      setEventIndex((current) => {
        if (events.length === 0) return 0;
        return (current + direction + events.length) % events.length;
      });
      return;
    }

    setGearIndex((current) => {
      if (gearNews.length === 0) return 0;
      return (current + direction + gearNews.length) % gearNews.length;
    });
  };

  const shareByEmail = (title: string, text: string, url: string) => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${text}\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  };

  const shareEvent = (event: AdventureEventRecord) => {
    shareByEmail(event.name, `${event.name} • ${event.country}`, event.officialWebsite);
  };

  const shareLink = (title: string, text: string, url: string) => {
    shareByEmail(title, text, url);
  };

  const eventFallbackImage = (event: AdventureEventRecord) =>
    buildLogoFallbackImage(event.name, event.type, event.logo, ["#22d3ee", "#a855f7"]);

  const gearFallbackImage = (item: GearDiscoveryItem) =>
    buildLogoFallbackImage(item.title, item.subtitle, item.brandLogo, ["#38bdf8", "#ec4899"]);

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>, fallbackSrc: string) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "1") return;
    image.dataset.fallbackApplied = "1";
    image.src = fallbackSrc;
  };

  const handleEventImageError = (event: SyntheticEvent<HTMLImageElement>, record: AdventureEventRecord) => {
    handleImageError(event, eventFallbackImage(record));
  };

  if (style === "sport") {
    return (
      <div className="grid w-full gap-4">
        <div className="rounded-[28px] border border-cyan-400/14 bg-slate-950/78 p-4 shadow-[0_24px_60px_rgba(8,47,73,0.24)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <motion.div
                className="flex h-11 w-11 items-center justify-center rounded-2xl brand-gradient shadow-[0_10px_24px_rgba(168,85,247,0.26)]"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Bike className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">{sportCopy.diagnostics}</p>
                <p className="mt-1 text-2xl font-semibold leading-tight text-white">{sportCopy.system}</p>
              </div>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-100/90">
              {sportCopy.live}
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#a855f7)]"
              animate={{ width: `${Math.max(percent, 6)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/45">
            <span>{phaseLabel}</span>
            <span>{percent}%</span>
          </div>
        </div>

        <div className="grid gap-3">
          {featuredEvent && (
            <motion.article
              key={featuredEvent.id}
              className="group overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80 shadow-[0_18px_38px_rgba(15,23,42,0.34)] ring-1 ring-white/5"
              whileHover={{ y: -2 }}
            >
              <div className="relative h-44 w-full overflow-hidden">
                {featuredEvent.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featuredEvent.image}
                      alt={`${featuredEvent.name} scene`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      onError={(e) => handleEventImageError(e, featuredEvent)}
                    />
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={eventFallbackImage(featuredEvent)}
                      alt={`${featuredEvent.name} fallback scene`}
                      className="h-full w-full object-cover"
                    />
                  </>
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.72))]" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-3">
                  <motion.div
                    className="h-14 w-14 overflow-hidden rounded-2xl border border-white/25 bg-white/95 shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
                    animate={{ y: [-0.4, 0.7, -0.4] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {featuredEvent.logo && !failedLogos.has(featuredEvent.id) ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={featuredEvent.logo}
                          alt={`${featuredEvent.name} logo`}
                          className="h-full w-full object-contain p-1.5"
                          onError={() => markLogoFailed(featuredEvent.id)}
                          onLoad={(e) => {
                            if (e.currentTarget.naturalWidth < 96 || e.currentTarget.naturalHeight < 96) {
                              markLogoFailed(featuredEvent.id);
                            }
                          }}
                        />
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-800">{initials(featuredEvent.name)}</div>
                    )}
                  </motion.div>
                  <div className="flex items-center gap-2">
                    {events.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => cycleStory("events", -1)}
                          className="rounded-full border border-white/12 bg-slate-950/60 p-1.5 text-white/75 transition hover:bg-white/[0.1]"
                          aria-label={discoveryCopy.previous}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => cycleStory("events", 1)}
                          className="rounded-full border border-white/12 bg-slate-950/60 p-1.5 text-white/75 transition hover:bg-white/[0.1]"
                          aria-label={discoveryCopy.next}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <span className="rounded-full border border-white/15 bg-slate-950/65 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/85">
                      {featuredEvent.type}
                    </span>
                  </div>
                </div>
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="text-xl font-semibold text-white">{featuredEvent.name}</p>
                  <p className="text-xs text-white/80">{featuredEvent.location} · {featuredEvent.country}</p>
                </div>
              </div>
            </motion.article>
          )}

          {featuredGear && (
            <motion.article
              key={featuredGear.id}
              className="group overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80 shadow-[0_18px_38px_rgba(15,23,42,0.34)] ring-1 ring-white/5"
              whileHover={{ y: -2 }}
            >
              <div className="relative h-44 w-full overflow-hidden">
                {featuredGear.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featuredGear.image}
                      alt={`${featuredGear.title} visual`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      onError={(e) => handleImageError(e, gearFallbackImage(featuredGear))}
                    />
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gearFallbackImage(featuredGear)}
                      alt={`${featuredGear.title} fallback visual`}
                      className="h-full w-full object-cover"
                    />
                  </>
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.72))]" />
                <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
                  <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (featuredGear.kind === "new-model" ? "bg-cyan-400/25 text-cyan-100" : featuredGear.kind === "brand-news" ? "bg-fuchsia-400/25 text-fuchsia-100" : "bg-emerald-400/25 text-emerald-100")}>
                    {featuredGear.kind === "new-model" ? discoveryCopy.newModel : featuredGear.kind === "brand-news" ? discoveryCopy.brandNews : discoveryCopy.community}
                  </span>
                  <div className="flex items-center gap-2">
                    {gearNews.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => cycleStory("gear", -1)}
                          className="rounded-full border border-white/12 bg-slate-950/60 p-1.5 text-white/75 transition hover:bg-white/[0.1]"
                          aria-label={discoveryCopy.previous}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => cycleStory("gear", 1)}
                          className="rounded-full border border-white/12 bg-slate-950/60 p-1.5 text-white/75 transition hover:bg-white/[0.1]"
                          aria-label={discoveryCopy.next}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <span className="rounded-full bg-slate-950/60 px-2 py-0.5 text-[10px] text-white/85">{featuredGear.brand}</span>
                  </div>
                </div>
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="line-clamp-2 text-lg font-semibold leading-tight text-white">{featuredGear.title}</p>
                  <p className="truncate text-xs text-white/80">{featuredGear.subtitle}</p>
                </div>
              </div>
              <div className="px-3 pb-3 pt-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100/80">{copy.gearLabel(featuredGear.category)} · {featuredGear.brand}</p>
                <p className="mb-2 text-sm font-medium leading-snug text-white/95">{featuredGear.summary}</p>
                <div className="rounded-2xl border border-fuchsia-300/10 bg-[linear-gradient(180deg,rgba(168,85,247,0.08),rgba(15,23,42,0.55))] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-[11px] leading-relaxed text-white/70">{featuredGear.description}</p>
                </div>
              </div>
            </motion.article>
          )}
          {!featuredEvent && !featuredGear && (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-[12px] text-white/65">
              {discoveryCopy.upcomingSubtitle}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-4" style={{ gridTemplateRows: "auto 1fr" }}>
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 glass-card px-5 py-6 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full brand-gradient opacity-30 blur-xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full brand-gradient"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          >
            <Clapperboard className="h-7 w-7 text-white" />
          </motion.div>
        </div>

        <div>
          <p className="text-base font-semibold text-white/90">{copy.render.editing.replace("{style}", styleLabel)}</p>
          <p className="mt-1 text-xs text-white/45">{phaseLabel}</p>
        </div>

        <FunProgressBar progress={progress} messages={copy.renderMessages} />

        <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <div className="text-center text-base font-semibold text-white/90">{percent}% {discoveryCopy.complete}</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateRows: "auto auto", minHeight: 520 }}>
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.32))] px-4 py-4 shadow-[0_22px_55px_rgba(2,6,23,0.42)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">{discoveryCopy.upcomingTitle}</p>
              <p className="text-base font-semibold text-white/92">{discoveryCopy.upcomingSubtitle}</p>
            </div>
            {events.length > 1 && (
              <div className="flex items-center gap-2">
               <button
                 type="button"
                 onClick={() => cycleStory("events", -1)}
                 className="rounded-full border border-white/12 bg-white/[0.04] p-1.5 text-white/75 transition hover:bg-white/[0.1]"
                 aria-label={discoveryCopy.previous}
               >
                 <ChevronLeft className="h-3.5 w-3.5" />
               </button>
               <button
                 type="button"
                 onClick={() => cycleStory("events", 1)}
                 className="rounded-full border border-white/12 bg-white/[0.04] p-1.5 text-white/75 transition hover:bg-white/[0.1]"
                 aria-label={discoveryCopy.next}
               >
                 <ChevronRight className="h-3.5 w-3.5" />
               </button>
               <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-cyan-100/90">
                 {discoveryProfile.toUpperCase()}
               </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {featuredEvent ? (() => {
              const countdown = formatCountdown(featuredEvent.startDate, nowMs, {
               days: discoveryCopy.countdownDays,
               hours: discoveryCopy.countdownHours,
               minutes: discoveryCopy.countdownMinutes,
              });
              const dateLabel = formatDateRange(featuredEvent.startDate, featuredEvent.endDate, locale);
              const logoFallback = initials(featuredEvent.name);
              return (
               <motion.article
                 key={featuredEvent.id}
                 className="group overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80 shadow-[0_18px_38px_rgba(15,23,42,0.34)] ring-1 ring-white/5"
                 whileHover={{ y: -2 }}
               >
                 <div className="relative h-40 w-full overflow-hidden">
                   {featuredEvent.image ? (
                     <>
                       {/* eslint-disable-next-line @next/next/no-img-element */}
                       <img
                         src={featuredEvent.image}
                         alt={`${featuredEvent.name} scene`}
                         className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                         onError={(e) => handleEventImageError(e, featuredEvent)}
                       />
                     </>
                   ) : (
                     <>
                       {/* eslint-disable-next-line @next/next/no-img-element */}
                       <img
                         src={eventFallbackImage(featuredEvent)}
                         alt={`${featuredEvent.name} fallback scene`}
                         className="h-full w-full object-cover"
                       />
                     </>
                   )}
                   <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.72))]" />
                   <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-3">
                     <motion.div
                       className="h-14 w-14 overflow-hidden rounded-2xl border border-white/25 bg-white/95 shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
                       animate={{ y: [-0.4, 0.7, -0.4] }}
                       transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                     >
                       {featuredEvent.logo && !failedLogos.has(featuredEvent.id) ? (
                         <>
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img
                             src={featuredEvent.logo}
                             alt={`${featuredEvent.name} logo`}
                             className="h-full w-full object-contain p-1.5"
                             onError={() => markLogoFailed(featuredEvent.id)}
                             onLoad={(e) => {
                               if (e.currentTarget.naturalWidth < 96 || e.currentTarget.naturalHeight < 96) {
                                 markLogoFailed(featuredEvent.id);
                               }

                             }}
                           />
                         </>
                       ) : (
                         <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-800">{logoFallback}</div>
                       )}
                     </motion.div>
                     <span className="rounded-full border border-white/15 bg-slate-950/65 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/85">
                       {featuredEvent.type}
                     </span>
                   </div>
                   <div className="absolute bottom-2 left-3 right-3">
                     <p className="text-xl font-semibold text-white">{featuredEvent.name}</p>
                     <p className="text-xs text-white/80">{featuredEvent.location} · {featuredEvent.country}</p>
                   </div>
                 </div>

                 <div className="space-y-2.5 px-3 pb-3 pt-3 text-sm text-white/80">
                   <div className="flex items-center justify-between gap-2 rounded-2xl border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(14,116,144,0.18),rgba(15,23,42,0.58))] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                     <div>
                       <p className="text-[10px] uppercase tracking-[0.13em] text-cyan-100/70">{discoveryCopy.startsIn}</p>
                       <p className="mt-1 text-sm font-semibold text-white">{countdown}</p>
                     </div>
                     <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/75">
                       {featuredEvent.featured ? "Featured" : "Live"}
                     </span>
                   </div>
                   <p className="flex items-center gap-1.5 text-xs text-white/75"><LocateFixed className="h-3.5 w-3.5 text-cyan-200/80" /> {dateLabel}</p>
                   {expanded.has(featuredEvent.id) ? (
                     <p className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] leading-relaxed text-white/70">
                       {featuredEvent.description}
                     </p>
                   ) : (
                     <p className="text-[11px] leading-relaxed text-white/65">{featuredEvent.description}</p>
                   )}

                   <div className="mt-1 flex items-center gap-1.5">
                     <a
                       href={featuredEvent.officialWebsite}
                       target="_blank"
                       rel="noreferrer"
                       className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-fuchsia-300/35 bg-fuchsia-500/10 px-2 py-1.5 text-[11px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                     >
                       {discoveryCopy.discoverEvent}
                       <ExternalLink className="h-3 w-3" />
                     </a>
                     <button
                       onClick={() => toggleSet(setSaved, featuredEvent.id)}
                       className={"rounded-xl border px-2 py-1.5 transition " + (saved.has(featuredEvent.id) ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-200" : "border-white/12 bg-white/[0.02] text-white/70")}
                       aria-label="Save event"
                     >
                       <Bookmark className="h-3.5 w-3.5" />
                     </button>
                     <button
                       onClick={() => toggleSet(setLiked, featuredEvent.id)}
                       className={"rounded-xl border px-2 py-1.5 transition " + (liked.has(featuredEvent.id) ? "border-rose-300/35 bg-rose-500/10 text-rose-200" : "border-white/12 bg-white/[0.02] text-white/70")}
                       aria-label="Like event"
                     >
                       <Heart className="h-3.5 w-3.5" />
                     </button>
                     <button
                       onClick={() => shareEvent(featuredEvent)}
                       className="rounded-xl border border-white/12 bg-white/[0.02] px-2 py-1.5 text-white/70 transition hover:bg-white/[0.06]"
                       aria-label={discoveryCopy.shareByEmail}
                     >
                       <Share2 className="h-3.5 w-3.5" />
                     </button>
                     <button
                       onClick={() => toggleSet(setExpanded, featuredEvent.id)}
                       className="rounded-xl border border-white/12 bg-white/[0.02] px-2 py-1.5 text-white/70 transition hover:bg-white/[0.06]"
                       aria-label="View details"
                     >
                       <Info className="h-3.5 w-3.5" />
                     </button>
                   </div>
                 </div>
               </motion.article>
              );
            })() : null}
            {!featuredEvent && (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-[12px] text-white/65">
                {discoveryCopy.upcomingSubtitle}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.32))] px-4 py-4 shadow-[0_22px_55px_rgba(2,6,23,0.42)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-100/75">{discoveryCopy.gearTitle}</p>
              <p className="text-base font-semibold text-white/92">{discoveryCopy.gearSubtitle}</p>
            </div>
            {gearNews.length > 1 && (
              <div className="flex items-center gap-2">
               <button
                 type="button"
                 onClick={() => cycleStory("gear", -1)}
                 className="rounded-full border border-white/12 bg-white/[0.04] p-1.5 text-white/75 transition hover:bg-white/[0.1]"
                 aria-label={discoveryCopy.previous}
               >
                 <ChevronLeft className="h-3.5 w-3.5" />
               </button>
               <button
                 type="button"
                 onClick={() => cycleStory("gear", 1)}
                 className="rounded-full border border-white/12 bg-white/[0.04] p-1.5 text-white/75 transition hover:bg-white/[0.1]"
                 aria-label={discoveryCopy.next}
               >
                 <ChevronRight className="h-3.5 w-3.5" />
               </button>
               <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-fuchsia-100/90">
                 {discoveryCopy.personalized}
               </span>
              </div>
            )}
          </div>
          {gearNews.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-[12px] text-white/65">
              {discoveryCopy.selectGearHint}
            </div>
          ) : (
            <div className="space-y-3">
              {featuredGear ? (() => (
              <motion.article
                key={featuredGear.id}
                className="group overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80 shadow-[0_18px_38px_rgba(15,23,42,0.34)] ring-1 ring-white/5"
                whileHover={{ y: -2 }}
              >
              <div className="relative h-40 w-full overflow-hidden">
                {featuredGear.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featuredGear.image}
                      alt={`${featuredGear.title} visual`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      onError={(e) => handleImageError(e, gearFallbackImage(featuredGear))}
                    />
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gearFallbackImage(featuredGear)}
                      alt={`${featuredGear.title} fallback visual`}
                      className="h-full w-full object-cover"
                    />
                  </>
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.72))]" />
                <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
                  <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (featuredGear.kind === "new-model" ? "bg-cyan-400/25 text-cyan-100" : featuredGear.kind === "brand-news" ? "bg-fuchsia-400/25 text-fuchsia-100" : "bg-emerald-400/25 text-emerald-100")}>
                    {featuredGear.kind === "new-model" ? discoveryCopy.newModel : featuredGear.kind === "brand-news" ? discoveryCopy.brandNews : discoveryCopy.community}
                  </span>
                  <span className="rounded-full bg-slate-950/60 px-2 py-0.5 text-[10px] text-white/85">{featuredGear.brand}</span>
                </div>
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="line-clamp-2 text-lg font-semibold leading-tight text-white">{featuredGear.title}</p>
                  <p className="truncate text-xs text-white/80">{featuredGear.subtitle}</p>
                </div>
              </div>
              <div className="px-3 pb-3 pt-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100/80">{copy.gearLabel(featuredGear.category)} · {featuredGear.brand}</p>
                <p className="mb-2 text-sm font-medium leading-snug text-white/95">{featuredGear.summary}</p>
                <div className="rounded-2xl border border-fuchsia-300/10 bg-[linear-gradient(180deg,rgba(168,85,247,0.08),rgba(15,23,42,0.55))] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-[11px] leading-relaxed text-white/70">{featuredGear.description}</p>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1.5 px-3 pb-3">
                  <a
                    href={featuredGear.ctaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-2 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    {featuredGear.ctaLabel}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => toggleSet(setSavedGear, featuredGear.id)}
                    className={"rounded-xl border px-2 py-1.5 transition " + (savedGear.has(featuredGear.id) ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-200" : "border-white/12 bg-white/[0.02] text-white/70")}
                    aria-label="Save gear update"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleSet(setLikedGear, featuredGear.id)}
                    className={"rounded-xl border px-2 py-1.5 transition " + (likedGear.has(featuredGear.id) ? "border-rose-300/35 bg-rose-500/10 text-rose-200" : "border-white/12 bg-white/[0.02] text-white/70")}
                    aria-label="Like gear update"
                  >
                    <Heart className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => shareLink(featuredGear.title, `${featuredGear.brand} • ${copy.gearLabel(featuredGear.category)}`, featuredGear.ctaUrl)}
                    className="rounded-xl border border-white/12 bg-white/[0.02] px-2 py-1.5 text-white/70 transition hover:bg-white/[0.06]"
                    aria-label={discoveryCopy.shareByEmail}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleSet(setExpandedGear, featuredGear.id)}
                    className="rounded-xl border border-white/12 bg-white/[0.02] px-2 py-1.5 text-white/70 transition hover:bg-white/[0.06]"
                    aria-label="View gear details"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
                {expandedGear.has(featuredGear.id) && (
                  <p className="mx-3 mb-3 mt-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm leading-relaxed text-white/75">
                    {discoveryCopy.detailPrefix}: {featuredGear.brand} • {copy.gearLabel(featuredGear.category)}.
                  </p>
                )}
              </motion.article>
              ))() : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MaskedLabImage({
  className,
  image,
  fallback,
  title,
  subtitle,
  onError,
}: {
  className?: string;
  image?: string | null;
  fallback?: string;
  title: string;
  subtitle: string;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
}) {
  return (
    <motion.div
      className={`group relative overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/90 ${className ?? ""}`}
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      style={{ clipPath: "polygon(0 0, 88% 0, 100% 14%, 100% 100%, 12% 100%, 0 86%)" }}
    >
      {image || fallback ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image || fallback}
            alt={title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
            onError={onError}
          />
        </>
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.2),transparent_32%),linear-gradient(135deg,#020617,#111827)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.82))]" />
      <div className="absolute inset-x-4 bottom-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/65">{subtitle}</p>
        <p className="mt-1 line-clamp-2 text-lg font-semibold text-white">{title}</p>
      </div>
    </motion.div>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w.charAt(0).toUpperCase()).join("");
}

function formatDateRange(startIso: string, endIso: string, locale: Locale): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const formatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatCountdown(startIso: string, nowMs: number, labels?: { days: string; hours: string; minutes: string }): string {
  const diffMs = Math.max(0, new Date(startIso).getTime() - nowMs);
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const dayLabel = labels?.days ?? "Days";
  const hourLabel = labels?.hours ?? "Hours";
  const minuteLabel = labels?.minutes ?? "Minutes";
  return `${days} ${dayLabel} · ${hours} ${hourLabel} · ${minutes} ${minuteLabel}`;
}

function buildLogoFallbackImage(
  title: string,
  subtitle: string,
  logoSrc: string | null | undefined,
  colors: [string, string],
): string {
  const safeTitle = escapeSvgText(title);
  const safeSubtitle = escapeSvgText(subtitle);
  const safeLogoSrc = logoSrc ? escapeSvgText(logoSrc) : "";
  const logoBlock = safeLogoSrc
    ? `<rect x="438" y="160" width="324" height="180" rx="26" fill="rgba(15,23,42,0.34)"/>
<image href="${safeLogoSrc}" x="462" y="180" width="276" height="140" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${colors[0]}"/>
<stop offset="100%" stop-color="${colors[1]}"/>
</linearGradient>
</defs>
<rect width="1200" height="800" fill="#0b1220"/>
<rect width="1200" height="800" fill="url(#g)" opacity="0.35"/>
<circle cx="980" cy="140" r="220" fill="${colors[1]}" opacity="0.18"/>
<circle cx="180" cy="120" r="200" fill="${colors[0]}" opacity="0.16"/>
${logoBlock}
<text x="64" y="650" fill="#f8fafc" font-size="62" font-family="Arial, sans-serif" font-weight="700">${safeTitle}</text>
<text x="64" y="712" fill="#cbd5e1" font-size="36" font-family="Arial, sans-serif">${safeSubtitle}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
