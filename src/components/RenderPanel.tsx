"use client";

import { Dispatch, SetStateAction, SyntheticEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, Heart, Info, LocateFixed, Share2 } from "lucide-react";
import FunProgressBar from "@/components/FunProgressBar";
import { AdventureEventRecord, loadAdventureEvents } from "@/lib/adventure-events";
import { GearDiscoveryItem, loadGearDiscoveryItems } from "@/lib/gear-discovery";
import { useLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface RenderPanelProps {
  /** 0-1 progress. `null` while the ffmpeg.wasm engine itself is still downloading/booting. */
  progress: number | null;
  phaseLabel: string;
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
  useEffect(() => {
    let cancelled = false;
    void loadAdventureEvents("adventure").then((items) => {
      if (!cancelled) setEvents(items);
    }).catch((error) => {
      console.error("[RenderPanel] adventure events loading failed", error);
      if (!cancelled) setEvents([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadGearDiscoveryItems().then((items) => {
      if (!cancelled) setGearNews(items);
    }).catch((error) => {
      console.error("[RenderPanel] gear discovery loading failed", error);
      if (!cancelled) setGearNews([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ticker = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);

  const percent = progress === null ? 0 : Math.round(progress * 100);
  const discoveryCopy = RENDER_DISCOVERY_COPY[locale];
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
          <p className="text-base font-semibold text-white/90">{copy.render.editing}</p>
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
                 {discoveryCopy.personalized}
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
                 className="group relative w-full max-w-[1100px] overflow-hidden rounded-[24px] border border-white/10 shadow-[0_18px_38px_rgba(15,23,42,0.34)] sm:max-w-full"
                 whileHover={{ y: -2 }}
                 style={{
                   backgroundColor: "var(--surface)",
                   backgroundImage:
                     "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                   backgroundSize: "24px 24px",
                 }}
               >
                 <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
                   <div className="flex items-center justify-between gap-2">
                     <span className="text-[0.58rem] font-bold uppercase tracking-[0.22em] text-cyan-100/75">
                       NEWS
                     </span>
                     <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.56rem] font-medium uppercase tracking-[0.15em] text-white/70">
                       {dateLabel}
                     </span>
                   </div>

                   <div className="flex items-start gap-3">
                     <div
                       className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-black/10 bg-white text-[0.8rem] font-black text-slate-800 shadow-[0_8px_18px_rgba(0,0,0,0.12)] sm:h-12 sm:w-12"
                     >
                       {featuredEvent.logo && !failedLogos.has(featuredEvent.id) ? (
                         <img
                           src={featuredEvent.logo}
                           alt={`${featuredEvent.name} logo`}
                           className="h-full w-full object-contain p-1.25 sm:p-1.5"
                           onError={() => markLogoFailed(featuredEvent.id)}
                         />
                       ) : (
                         <span>{logoFallback}</span>
                       )}
                     </div>

                     <h3 className="min-w-0 flex-1 text-[clamp(0.95rem,1.6vw,1.5rem)] font-black uppercase leading-[1.04] tracking-[-0.06em] text-white/95">
                       {featuredEvent.name}
                     </h3>
                   </div>

                   <p className="max-w-[68ch] text-[clamp(0.72rem,1.2vw,0.98rem)] leading-[1.28] text-white/85">
                     {featuredEvent.description}
                   </p>

                   <div className="flex items-center justify-end">
                     <button
                       type="button"
                       onClick={() => window.open(featuredEvent.officialWebsite, "_blank", "noopener,noreferrer")}
                       className="inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-[0.72rem] font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.18)] transition hover:translate-y-[-1px] sm:px-5 sm:py-2.5"
                       style={{ background: "var(--brand-from)" }}
                     >
                       Read more
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
                className="group relative w-full max-w-[1100px] overflow-hidden rounded-[24px] border border-white/10 shadow-[0_18px_38px_rgba(15,23,42,0.34)] sm:max-w-full"
                whileHover={{ y: -2 }}
                style={{
                  backgroundColor: "var(--surface)",
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              >
                <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.22em] text-fuchsia-100/75">
                      GEAR
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.56rem] font-medium uppercase tracking-[0.15em] text-white/70">
                      {discoveryCopy.newModel}
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-black/10 bg-white text-[0.8rem] font-black text-slate-800 shadow-[0_8px_18px_rgba(0,0,0,0.12)] sm:h-12 sm:w-12"
                    >
                      {featuredGear.image ? (
                        <img
                          src={featuredGear.image}
                          alt={`${featuredGear.title} visual`}
                          className="h-full w-full object-contain p-1.25 sm:p-1.5"
                          onError={(e) => handleImageError(e, gearFallbackImage(featuredGear))}
                        />
                      ) : (
                        <span>{initials(featuredGear.title)}</span>
                      )}
                    </div>

                    <h3 className="min-w-0 flex-1 text-[clamp(0.95rem,1.6vw,1.5rem)] font-black uppercase leading-[1.04] tracking-[-0.06em] text-white/95">
                      {featuredGear.title}
                    </h3>
                  </div>

                  <p className="max-w-[68ch] text-[clamp(0.72rem,1.2vw,0.98rem)] leading-[1.28] text-white/85">
                    {featuredGear.summary}
                  </p>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => window.open(featuredGear.ctaUrl, "_blank", "noopener,noreferrer")}
                      className="inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-[0.72rem] font-bold text-white shadow-[0_6px_0_rgba(0,0,0,0.18)] transition hover:translate-y-[-1px] sm:px-5 sm:py-2.5"
                      style={{ background: "var(--brand-from)" }}
                    >
                      Read more
                    </button>
                  </div>
                </div>
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
