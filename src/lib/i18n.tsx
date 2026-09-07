"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AppStep, ReelStyle, PlanId } from "@/types";
import type { GearCategoryKey } from "@/data/gearCatalog";

export type Locale = "fr" | "de" | "en" | "es" | "it" | "zh";

export const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "fr", label: "Français" },
  { value: "de", label: "Allemand" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
  { value: "it", label: "Italien" },
  { value: "zh", label: "Chinois" },
];

type Copy = ReturnType<typeof buildCopy>;

const localeToHtmlLang: Record<Locale, string> = {
  fr: "fr",
  de: "de",
  en: "en",
  es: "es",
  it: "it",
  zh: "zh",
};

const LANGUAGE_LABELS: Record<Locale, string> = {
  fr: "Français",
  de: "Deutsch",
  en: "English",
  es: "Español",
  it: "Italiano",
  zh: "中文",
};

const STEP_LABELS: Record<Locale, Record<AppStep, string>> = {
  fr: { upload: "Téléversement", style: "Style", analyze: "Analyse", render: "Édition", preview: "Aperçu" },
  de: { upload: "Upload", style: "Stil", analyze: "Analyse", render: "Bearbeitung", preview: "Vorschau" },
  en: { upload: "Upload", style: "Style", analyze: "Analyze", render: "Edit", preview: "Preview" },
  es: { upload: "Subida", style: "Estilo", analyze: "Análisis", render: "Edición", preview: "Vista previa" },
  it: { upload: "Caricamento", style: "Stile", analyze: "Analisi", render: "Modifica", preview: "Anteprima" },
  zh: { upload: "上传", style: "风格", analyze: "分析", render: "编辑", preview: "预览" },
};

const ANALYSIS_STEPS: Record<Locale, string[]> = {
  fr: ["Préparation des images", "Évaluation du mouvement", "Recherche des meilleurs moments", "Affinage des coupes"],
  de: ["Bilder werden vorbereitet", "Bewegung wird bewertet", "Beste Momente werden gesucht", "Schnitte werden verfeinert"],
  en: ["Preparing frames", "Scoring motion", "Finding best moments", "Refining cuts"],
  es: ["Preparando fotogramas", "Evaluando movimiento", "Buscando los mejores momentos", "Afinando cortes"],
  it: ["Preparazione dei frame", "Valutazione del movimento", "Ricerca dei momenti migliori", "Rifinitura dei tagli"],
  zh: ["准备画面", "评估运动", "寻找最佳片段", "细化剪辑"],
};

const STYLE_COPY: Record<Locale, Record<ReelStyle, { label: string; description: string }>> = {
  fr: {
    viral: { label: "Viral", description: "Montage rapide, captions percutantes, pensé pour arrêter le scroll." },
    travel: { label: "Voyage", description: "Storytelling chaleureux et rêveur, centré sur l’évasion." },
    adventure: { label: "Aventure", description: "Rythme énergique, adrénaline et plein air." },
    sport: { label: "Sport", description: "Cadence punchy construite autour des pics d’action." },
    cinematic: { label: "Cinématique", description: "Rythme lent, ambiance film et couleur travaillée." },
    luxury: { label: "Luxe", description: "Univers premium, minimal et haut de gamme." },
  },
  de: {
    viral: { label: "Viral", description: "Schnelle Schnitte, starke Captions, für maximalen Scroll-Stop." },
    travel: { label: "Reise", description: "Warme, träumerische Storytelling-Ästhetik." },
    adventure: { label: "Abenteuer", description: "Energiegeladen, draußen, adrenalingeladen." },
    sport: { label: "Sport", description: "Punchiger Rhythmus rund um die Action-Höhepunkte." },
    cinematic: { label: "Kinematisch", description: "Langsam, stimmungsvoll, filmisch inszeniert." },
    luxury: { label: "Luxus", description: "Premium, minimal und hochwertig." },
  },
  en: {
    viral: { label: "Viral", description: "Fast cuts, bold captions, built to stop the scroll." },
    travel: { label: "Travel", description: "Warm, dreamy, wanderlust-driven storytelling." },
    adventure: { label: "Adventure", description: "High energy, outdoors, adrenaline-first pacing." },
    sport: { label: "Sport", description: "Punchy rhythm built around action peaks." },
    cinematic: { label: "Cinematic", description: "Slow, moody, film-grade color and pacing." },
    luxury: { label: "Luxury", description: "Premium, minimal, high-end brand feel." },
  },
  es: {
    viral: { label: "Viral", description: "Cortes rápidos, subtítulos potentes, pensados para detener el scroll." },
    travel: { label: "Viaje", description: "Narrativa cálida, soñadora y orientada a la aventura." },
    adventure: { label: "Aventura", description: "Ritmo enérgico, exterior y adrenalina." },
    sport: { label: "Deporte", description: "Ritmo contundente construido alrededor de la acción." },
    cinematic: { label: "Cinematográfico", description: "Lento, atmosférico y con color de cine." },
    luxury: { label: "Lujo", description: "Sensación premium, minimalista y elegante." },
  },
  it: {
    viral: { label: "Virale", description: "Tagli rapidi, caption forti, pensato per fermare lo scroll." },
    travel: { label: "Viaggio", description: "Storytelling caldo, sognante e da voglia di partire." },
    adventure: { label: "Avventura", description: "Energia alta, outdoor e adrenalina." },
    sport: { label: "Sport", description: "Ritmo incisivo costruito sui picchi d’azione." },
    cinematic: { label: "Cinematografico", description: "Lento, malinconico e dal look filmico." },
    luxury: { label: "Lusso", description: "Elegante, minimale e premium." },
  },
  zh: {
    viral: { label: "爆款", description: "快切、强字幕，专为抓住注意力而设计。" },
    travel: { label: "旅行", description: "温暖、梦幻、充满远方感的叙事。" },
    adventure: { label: "冒险", description: "高能、户外、以肾上腺素为先。" },
    sport: { label: "运动", description: "围绕动作高潮打造的强节奏剪辑。" },
    cinematic: { label: "电影感", description: "慢节奏、氛围感、电影级色彩。" },
    luxury: { label: "奢华", description: "高级、极简、品牌感十足。" },
  },
};

const PLAN_COPY: Record<
  Locale,
  Record<PlanId, { name: string; tagline: string; features: string[]; lockedFeatures: string[]; cta: string }>
> = {
  fr: {
    free: {
      name: "Gratuit",
      tagline: "Teste ClipsyReel sans carte bancaire",
      features: ["1 Reel par semaine", "Styles de base (Viral, Voyage)", "Export 720p", "Générateur de hook + légende"],
      lockedFeatures: ["Pas de suppression du watermark", "Pas de cartes de route GPX", "Pas de styles premium", "Pas d’export par lot"],
      cta: "Passer à Gratuit",
    },
    creator: {
      name: "Creator Pro",
      tagline: "Pour publier chaque semaine",
      features: ["30 Reels par mois", "Sans watermark", "Export HD (1080p)", "Tous les styles premium", "Cartes de route GPX", "Plus de variantes de hook et de légende"],
      lockedFeatures: [],
      cta: "Passer à Creator Pro",
    },
    business: {
      name: "Business Pro",
      tagline: "Pour les équipes et les créateurs avancés",
      features: ["Reels illimités", "Export 4K", "Génération par lot", "Personnalisation avancée", "Projets enregistrés", "Traitement prioritaire"],
      lockedFeatures: [],
      cta: "Passer à Business Pro",
    },
  },
  de: {
    free: {
      name: "Gratis",
      tagline: "ClipsyReel ohne Kreditkarte testen",
      features: ["1 Reel pro Woche", "Basis-Stile (Viral, Reise)", "720p-Export", "Hook- und Caption-Generator"],
      lockedFeatures: ["Kein Wasserzeichen entfernen", "Keine GPX-Routenkarten", "Keine Premium-Stile", "Kein Batch-Export"],
      cta: "Zu Gratis wechseln",
    },
    creator: {
      name: "Creator Pro",
      tagline: "Für alle, die jede Woche posten",
      features: ["30 Reels pro Monat", "Ohne Wasserzeichen", "HD-Export (1080p)", "Alle Premium-Stile", "GPX-Routenkarten", "Mehr Hook- und Caption-Varianten"],
      lockedFeatures: [],
      cta: "Zu Creator Pro wechseln",
    },
    business: {
      name: "Business Pro",
      tagline: "Für Teams und Power-Creators",
      features: ["Unbegrenzte Reels", "4K-Export", "Batch-Erstellung", "Erweiterte Anpassung", "Gespeicherte Projekte", "Priorisierte Verarbeitung"],
      lockedFeatures: [],
      cta: "Zu Business Pro wechseln",
    },
  },
  en: {
    free: {
      name: "Free",
      tagline: "Try ClipsyReel, no card required",
      features: ["1 Reel per week", "Basic styles (Viral, Travel)", "720p export", "Hook + caption generator"],
      lockedFeatures: ["No watermark removal", "No GPX route maps", "No premium styles", "No batch export"],
      cta: "Switch to Free",
    },
    creator: {
      name: "Creator Pro",
      tagline: "For creators who post every week",
      features: ["30 Reels per month", "No watermark", "HD (1080p) export", "All premium styles", "GPX route maps", "More hook & caption variants"],
      lockedFeatures: [],
      cta: "Upgrade to Creator Pro",
    },
    business: {
      name: "Business Pro",
      tagline: "For teams and power creators",
      features: ["Unlimited Reels", "4K export", "Batch generation", "Advanced customization", "Saved projects", "Priority processing"],
      lockedFeatures: [],
      cta: "Upgrade to Business Pro",
    },
  },
  es: {
    free: {
      name: "Gratis",
      tagline: "Prueba ClipsyReel sin tarjeta",
      features: ["1 Reel por semana", "Estilos básicos (Viral, Viaje)", "Exportación 720p", "Generador de hook + caption"],
      lockedFeatures: ["Sin quitar marca de agua", "Sin mapas de ruta GPX", "Sin estilos premium", "Sin exportación por lotes"],
      cta: "Cambiar a Gratis",
    },
    creator: {
      name: "Creator Pro",
      tagline: "Para creadores que publican cada semana",
      features: ["30 Reels al mes", "Sin marca de agua", "Exportación HD (1080p)", "Todos los estilos premium", "Mapas de ruta GPX", "Más variantes de hook y caption"],
      lockedFeatures: [],
      cta: "Mejorar a Creator Pro",
    },
    business: {
      name: "Business Pro",
      tagline: "Para equipos y creadores intensivos",
      features: ["Reels ilimitados", "Exportación 4K", "Generación por lotes", "Personalización avanzada", "Proyectos guardados", "Procesamiento prioritario"],
      lockedFeatures: [],
      cta: "Mejorar a Business Pro",
    },
  },
  it: {
    free: {
      name: "Gratis",
      tagline: "Prova ClipsyReel senza carta",
      features: ["1 Reel a settimana", "Stili base (Virale, Viaggio)", "Export 720p", "Generatore hook + caption"],
      lockedFeatures: ["Rimozione watermark assente", "Nessuna mappa GPX", "Nessuno stile premium", "Nessun export batch"],
      cta: "Passa a Gratis",
    },
    creator: {
      name: "Creator Pro",
      tagline: "Per chi pubblica ogni settimana",
      features: ["30 Reel al mese", "Senza watermark", "Export HD (1080p)", "Tutti gli stili premium", "Mappe GPX", "Più varianti hook e caption"],
      lockedFeatures: [],
      cta: "Passa a Creator Pro",
    },
    business: {
      name: "Business Pro",
      tagline: "Per team e power creator",
      features: ["Reel illimitati", "Export 4K", "Generazione batch", "Personalizzazione avanzata", "Progetti salvati", "Elaborazione prioritaria"],
      lockedFeatures: [],
      cta: "Passa a Business Pro",
    },
  },
  zh: {
    free: {
      name: "免费版",
      tagline: "无需信用卡即可试用 ClipsyReel",
      features: ["每周 1 个 Reel", "基础风格（爆款、旅行）", "720p 导出", "Hook + 文案生成"],
      lockedFeatures: ["无法去除水印", "没有 GPX 路线地图", "没有高级风格", "无法批量导出"],
      cta: "切换到免费版",
    },
    creator: {
      name: "Creator Pro",
      tagline: "适合每周发布内容的创作者",
      features: ["每月 30 个 Reels", "无水印", "1080p 高清导出", "全部高级风格", "GPX 路线地图", "更多 Hook 与文案变体"],
      lockedFeatures: [],
      cta: "升级到 Creator Pro",
    },
    business: {
      name: "Business Pro",
      tagline: "适合团队和高强度创作者",
      features: ["无限 Reels", "4K 导出", "批量生成", "高级自定义", "保存项目", "优先处理"],
      lockedFeatures: [],
      cta: "升级到 Business Pro",
    },
  },
};

const COPY = {
  fr: {
    shell: { free: "Gratuit", title: "ClipsyReel", chooseLanguage: "Choisir la langue" },
    hero: {
      badge: "Création de Reels alimentée par l’IA",
      titleTop: "Transforme n’importe quelle vidéo en",
      titleBottom: "un Reel qui arrête le scroll",
      description: "Importe ton MP4, choisis un style, et laisse ClipsyReel trouver les meilleurs moments, écrire ton hook et ta légende, puis exporter un Reel 9:16 prêt à publier.",
      fast: "Rapide",
      ready: "Prêt pour 9:16",
      noSkills: "Aucune compétence de montage nécessaire",
    },
    reelName: {
      title: "1. Nom du Reel",
      description: "Définis le titre, la typographie et la taille avant de construire le reste de l’histoire.",
      typography: "Typographie",
      letterSize: "Taille des lettres",
      color: "Couleur",
      livePreview: "Aperçu en direct",
      placeholder: "Tape ton texte ici",
      fontOptions: { cinematic: "Cinématique", modern: "Moderne", classic: "Classique", bold: "Gras", minimal: "Minimal", handwritten: "Écriture", elegant: "Élégant", impact: "Impact", mono: "Mono", rounded: "Arrondi" },
      sizeOptions: { sm: "Petit", md: "Moyen", lg: "Grand" },
    },
    upload: {
      title: "2. Importer des vidéos",
      description: "Importe jusqu’à 3 clips — ils seront combinés dans un seul montage.",
      add: "Ajouter un autre clip",
      combine: "Combiner jusqu’à 3 clips dans un seul montage",
      tap: "Appuie pour importer ton MP4",
      drag: "ou glisse-dépose · jusqu’à 500 Mo",
      ready: "prêt à créer",
      max: "Maximum de {maxVideos} clips par montage.",
      audioOn: "Audio activé",
      audioOff: "Audio désactivé",
      remove: "Supprimer la vidéo",
      upload: "Téléversement…",
    },
    route: {
      title: "3. Route (facultatif)",
      description: "Ajoute un itinéraire GPX ou définis un départ / une arrivée pour une intro carte, ou passe cette étape.",
      lockedTitle: "Les cartes de route GPX sont une fonctionnalité Pro",
      lockedMessage: "Importe ton fichier GPX ou planifie un trajet par nom de ville avec Creator Pro.",
      import: "Import GPX",
      plan: "Planifier une route",
      modeTitle: "Import GPX & planificateur de route",
      modeDescription: "Importe un fichier GPX ou planifie une route à partir de villes.",
      proBadge: "FONCTIONNALITÉ PRO",
      proCardTitle: "Import GPX & planificateur de route",
      proCardDescription: "Importe un fichier GPX ou planifie une route à partir de villes avec Creator Pro.",
      gpxTab: "Importer GPX",
      plannerTab: "Planifier la route",
      departure: "Départ",
      destination: "Arrivée",
      stops: "Étapes",
      addStop: "Ajouter une étape",
      vehicle: "Véhicule",
      vehicleLabels: { car: "Voiture", motorcycle: "Moto", bicycle: "Vélo", walking: "À pied" },
      generate: "Générer la route",
      generating: "Génération…",
      routeError: "Impossible de générer la route sur cet appareil.",
      locationMode: "Planificateur",
      importMode: "GPX",
      gpxHint: "Glisse ton fichier GPX ou clique pour le sélectionner.",
      gpxSelected: "Fichier sélectionné",
      routeStats: "Statistiques de route",
    },
    hook: {
      title: "4. Hook",
      description: "Configure les textes d’ouverture qui attirent l’attention au début de ton Reel.",
    },
    style: {
      pickTitle: "2. Choisis un style de Reel",
      pickDescription: "Cela influence les coupes, les transitions, le rythme du zoom, le ton du hook et l’ambiance musicale.",
      equipmentTitle: "5. Équipements",
      equipmentDescription: "Tu peux encore ajuster tes équipements avant d’analyser les vidéos.",
      selectedStyle: "Style sélectionné :",
    },
    analysis: {
      title: "Analyse de la vidéo",
      description: "Analyse des images réelles pour le mouvement, la netteté et l’exposition",
      fallback: "L’analyse vidéo réelle a échoué, retour aux moments simulés",
    },
    render: {
      editing: "Montage de ton Reel {style}…",
      processingRoute: "Préparation de la carte de route animée…",
      processingGear: "Préparation de la carte récapitulative des équipements…",
      processingCuts: "Découpe, zoom et fondu enchaîné des clips…",
      loading: "Chargement du moteur d’édition…",
      retry: "Réessayer",
      continueRaw: "Continuer avec le clip brut",
      error: "Impossible de rendre le montage sur cet appareil. Tu peux réessayer ou continuer avec le clip brut.",
    },
    preview: {
      ready: "Montage rendu — coupes, zoom et transitions réels appliqués",
      readyAlt: "Analyse terminée — ton Reel est prêt à être prévisualisé",
      export: "Export",
      newReel: "Créer un nouveau Reel",
    },
    export: {
      quality: "Qualité d’export",
      watermark: "Filigrane",
      visible: "Visible à l’export",
      removed: "Supprimé",
      batch: "Exporter plusieurs Reels",
      comingSoon: "Bientôt",
      download: "Télécharger le MP4",
      rendering: "Rendu de ton Reel…",
      done: "Ton Reel est prêt — pense à l’ajouter manuellement dans Instagram 🎉",
      removeWatermark: "Retirer le filigrane avec Creator Pro",
    },
    pricing: {
      title: "Débloque ClipsyReel Pro",
      subtitle: "Crée plus, plus vite, sans filigrane.",
      footer: "Annule à tout moment. Prix affichés en EUR. Les paiements sont simulés dans ce MVP — Stripe Checkout sera intégré plus tard.",
    },
    upgrade: { later: "Peut-être plus tard", seePlans: "Voir les offres Pro" },
    story: {
      title: "Montage Story Instagram",
      description: "Une version Story plus longue, composée à partir de tes clips, limitée à 60 s (limite Instagram).",
      create: "Créer la version Story",
      download: "Télécharger le Story MP4",
      regenerate: "Régénérer",
      usesCredit: "Utilise le même crédit hebdo que ton export principal.",
      error: "Impossible de rendre la Story sur cet appareil. Essaie avec des vidéos plus courtes.",
    },
    diagnostics: {
      title: "Diagnostic du rendu",
      totalTime: "Temps total",
      hardware: "Matériel",
      phase1: "Phase 1 (coupes)",
      phase2: "Phase 2 (composition)",
      performance: "Score de performance",
      gpuOn: "Accélération GPU active",
      cpuMode: "Mode CPU (pense à un GPU plus rapide pour accélérer les rendus)",
      bottlenecks: "Bottlenecks détectés",
      suggestions: "Suggestions",
      quality: "Qualité de rendu",
      fast: "🚀 Rapide",
      standard: "✨ Std",
      premium: "👑 Max",
      kenBurns: "Désactive le zoom Ken Burns en mode aperçu pour rendre 30 % plus vite",
      gpuAdvice: "Installe les pilotes NVIDIA ou passe à un GPU pour l’accélération matérielle",
      previewAdvice: "Essaie le mode aperçu pour un feedback plus rapide",
    },
    common: {
      back: "Retour",
      chooseStyle: "Choisir un style",
      analyzeVideos: "Analyser la/les vidéo(s)",
      generateReel: "Générer le Reel",
      startNew: "Créer un nouveau Reel",
      exportLabel: "Export",
      currentPlan: "Plan actuel",
    },
    music: {
      note: "ClipsyReel suggère l’ambiance — ajoute ce morceau manuellement dans Instagram avant de publier (la licence musique reste du côté d’Instagram).",
    },
    renderNote: "Les coupes, zooms et transitions sont rendus sur ton appareil — aucun upload vers un serveur n’est nécessaire.",
  },
  de: {
    shell: { free: "Gratis", title: "ClipsyReel", chooseLanguage: "Sprache wählen" },
    hero: {
      badge: "KI-gestützte Reel-Erstellung",
      titleTop: "Verwandle jedes Video in",
      titleBottom: "ein Reel, das das Scrollen stoppt",
      description: "Lade dein MP4 hoch, wähle einen Stil und lass ClipsyReel die besten Momente finden, Hook und Caption schreiben und ein fertiges 9:16-Reel exportieren.",
      fast: "Schnell",
      ready: "9:16 bereit",
      noSkills: "Keine Schnittkenntnisse nötig",
    },
    reelName: { title: "1. Reel-Name", description: "Lege Titel, Typografie und Größe fest, bevor der Rest der Story gebaut wird.", typography: "Typografie", letterSize: "Schriftgröße", color: "Farbe", livePreview: "Live-Vorschau", placeholder: "Gib deinen Text hier ein", fontOptions: { cinematic: "Filmisch", modern: "Modern", classic: "Klassisch", bold: "Fett", minimal: "Minimal", handwritten: "Handschrift", elegant: "Elegant", impact: "Impact", mono: "Mono", rounded: "Rund" }, sizeOptions: { sm: "Klein", md: "Mittel", lg: "Groß" } },
    upload: { title: "2. Videos hochladen", description: "Lade bis zu 3 Clips hoch — sie werden zu einem einzigen Montagefilm kombiniert.", add: "Weiteren Clip hinzufügen", combine: "Bis zu 3 Clips zu einem Montagefilm kombinieren", tap: "Tippe, um dein MP4 hochzuladen", drag: "oder per Drag & Drop · bis zu 500 MB", ready: "bereit zum Erstellen", max: "Maximal {maxVideos} Clips pro Montage.", audioOn: "Audio an", audioOff: "Audio aus", remove: "Video entfernen", upload: "Wird hochgeladen…" },
    route: { title: "3. Route (optional)", description: "Füge eine GPX-Route hinzu oder definiere Start und Ziel für eine Karten-Intro — oder überspringe diesen Schritt.", lockedTitle: "GPX-Routenkarten sind eine Pro-Funktion", lockedMessage: "Lade deine GPX-Datei hoch oder plane eine Route per Städtename mit Creator Pro.", import: "GPX importieren", plan: "Route planen", modeTitle: "GPX-Import & Routenplaner", modeDescription: "Lade eine GPX-Datei hoch oder plane eine Route aus Städten.", proBadge: "PRO-FUNKTION", proCardTitle: "GPX-Import & Routenplaner", proCardDescription: "Lade eine GPX-Datei hoch oder plane eine Route aus Städten mit Creator Pro.", gpxTab: "GPX importieren", plannerTab: "Route planen", departure: "Start", destination: "Ziel", stops: "Stopps", addStop: "Stopp hinzufügen", vehicle: "Fahrzeug", vehicleLabels: { car: "Auto", motorcycle: "Motorrad", bicycle: "Fahrrad", walking: "Zu Fuß" }, generate: "Route erstellen", generating: "Erstelle…", routeError: "Route konnte auf diesem Gerät nicht erzeugt werden.", locationMode: "Planer", importMode: "GPX", gpxHint: "Ziehe deine GPX-Datei hierher oder klicke zum Auswählen.", gpxSelected: "Ausgewählte Datei", routeStats: "Routenstatistiken" },
    hook: { title: "4. Hook", description: "Konfiguriere die Auftakttexte, die den Start deines Reels aufmerksamkeitsstark machen." },
    style: { pickTitle: "2. Reel-Stil wählen", pickDescription: "Das beeinflusst Schnitte, Übergänge, Zoom-Rhythmus, Hook-Ton und Musikstimmung.", equipmentTitle: "3. Ausrüstung", equipmentDescription: "Die Analyse ist abgeschlossen. Fahre direkt mit den Ausrüstungs-Einstellungen fort.", selectedStyle: "Ausgewählter Stil:" },
    analysis: { title: "Videoanalyse", description: "Echte Frames werden auf Bewegung, Schärfe und Belichtung geprüft", fallback: "Die echte Videoanalyse ist fehlgeschlagen, Rückfall auf simulierte Momente" },
    render: { editing: "Dein {style}-Reel wird bearbeitet…", processingRoute: "Animierte Kartenroute wird vorbereitet…", processingGear: "Zusammenfassungskarte der Ausrüstung wird vorbereitet…", processingCuts: "Clips werden geschnitten, gezoomt und überblendet…", loading: "Bearbeitungs-Engine wird geladen…", retry: "Erneut versuchen", continueRaw: "Mit Rohclip fortfahren", error: "Das Montagevideo konnte auf diesem Gerät nicht gerendert werden. Du kannst es erneut versuchen oder mit dem Rohclip fortfahren." },
    preview: { ready: "Montage gerendert — echte Schnitte, Zooms und Übergänge angewendet", readyAlt: "Analyse abgeschlossen — dein Reel ist bereit zur Vorschau", export: "Export", newReel: "Neues Reel starten" },
    export: { quality: "Exportqualität", watermark: "Wasserzeichen", visible: "Beim Export sichtbar", removed: "Entfernt", batch: "Mehrere Reels exportieren", comingSoon: "Bald verfügbar", download: "MP4 herunterladen", rendering: "Dein Reel wird gerendert…", done: "Dein Reel ist fertig — denk daran, es manuell zu Instagram hinzuzufügen 🎉", removeWatermark: "Wasserzeichen mit Creator Pro entfernen" },
    pricing: { title: "ClipsyReel Pro freischalten", subtitle: "Mehr erstellen, schneller, ohne Wasserzeichen.", footer: "Jederzeit kündbar. Preise in EUR. Zahlungen sind im MVP simuliert — Stripe Checkout wird später integriert." },
    upgrade: { later: "Vielleicht später", seePlans: "Pro-Pläne ansehen" },
    story: { title: "Instagram Story-Schnitt", description: "Eine längere Story-Version, aus deinen Clips zusammengesetzt, auf 60 s begrenzt (Instagram-Limit).", create: "Story-Version erstellen", download: "Story MP4 herunterladen", regenerate: "Neu generieren", usesCredit: "Verwendet denselben Wochen-Export-Credit wie dein Haupt-Export.", error: "Die Story konnte auf diesem Gerät nicht gerendert werden. Bitte kürzere Videos versuchen." },
    diagnostics: { title: "Render-Diagnose", totalTime: "Gesamtzeit", hardware: "Hardware", phase1: "Phase 1 (Schnitte)", phase2: "Phase 2 (Komposition)", performance: "Performance-Score", gpuOn: "GPU-Beschleunigung aktiv", cpuMode: "CPU-Modus (für schnellere Renderings wäre eine GPU sinnvoll)", bottlenecks: "Erkannte Engpässe", suggestions: "Vorschläge", quality: "Render-Qualität", fast: "🚀 Schnell", standard: "✨ Std", premium: "👑 Max", kenBurns: "Deaktiviere den Ken-Burns-Zoom im Vorschaumodus, um 30 % schneller zu rendern", gpuAdvice: "Installiere NVIDIA-Treiber oder nutze eine GPU für Hardwarebeschleunigung", previewAdvice: "Nutze den Vorschaumodus für schnelleres Feedback" },
    common: { back: "Zurück", chooseStyle: "Stil wählen", analyzeVideos: "Video(s) analysieren", generateReel: "Reel erstellen", startNew: "Neues Reel starten", exportLabel: "Export", currentPlan: "Aktueller Plan" },
    music: { note: "ClipsyReel schlägt die Stimmung vor — füge diesen Track vor dem Posten manuell in Instagram hinzu (die Musiklizenz bleibt bei Instagram)." },
    renderNote: "Schnitte, Zooms und Übergänge werden auf deinem Gerät gerendert — kein Upload zu einem Server nötig.",
  },
  en: {
    shell: { free: "Free", title: "ClipsyReel", chooseLanguage: "Choose language" },
    hero: { badge: "AI-powered Reel creation", titleTop: "Turn any video into a", titleBottom: "scroll-stopping Reel", description: "Upload your MP4, pick a style, and let ClipsyReel find the best moments, write your hook & caption, and export a ready-to-post 9:16 Reel.", fast: "Fast", ready: "9:16 ready", noSkills: "No editing skills needed" },
    reelName: { title: "1. Reel Name", description: "Set your Reel title, typography and letter size before building the rest of the story.", typography: "Typography", letterSize: "Letter size", color: "Color", livePreview: "Live preview", placeholder: "Type your text here", fontOptions: { cinematic: "Cinematic", modern: "Modern", classic: "Classic", bold: "Bold", minimal: "Minimal", handwritten: "Handwritten", elegant: "Elegant", impact: "Impact", mono: "Mono", rounded: "Rounded" }, sizeOptions: { sm: "Small", md: "Medium", lg: "Large" } },
    upload: { title: "2. Upload Videos", description: "Upload up to 3 clips — they'll be combined into one montage.", add: "Add another clip", combine: "Combine up to 3 clips into one montage", tap: "Tap to upload your MP4", drag: "or drag & drop · up to 500MB", ready: "ready to craft", max: "Maximum of {maxVideos} clips per montage.", audioOn: "Audio on", audioOff: "Audio off", remove: "Remove video", upload: "Uploading…" },
    route: { title: "3. Route (Optional)", description: "Add a GPX route or define departure/destination for a map intro, or skip this step and continue normally.", lockedTitle: "GPX route maps are a Pro feature", lockedMessage: "Upload your GPX file or plan a route from city names with Creator Pro.", import: "Import GPX", plan: "Plan route", modeTitle: "GPX import & route planner", modeDescription: "Upload a GPX file or plan a route from cities.", proBadge: "PRO FEATURE", proCardTitle: "GPX import & route planner", proCardDescription: "Upload a GPX file or plan a route from cities with Creator Pro.", gpxTab: "Import GPX", plannerTab: "Plan route", departure: "Departure", destination: "Destination", stops: "Stops", addStop: "Add stop", vehicle: "Vehicle", vehicleLabels: { car: "Car", motorcycle: "Motorcycle", bicycle: "Bicycle", walking: "Walking" }, generate: "Generate route", generating: "Generating…", routeError: "Couldn't generate the route on this device.", locationMode: "Planner", importMode: "GPX", gpxHint: "Drop your GPX file here or click to choose.", gpxSelected: "Selected file", routeStats: "Route stats" },
    hook: { title: "4. Hook", description: "Configure the opening hook overlays that control the attention-grabbing start of your Reel." },
    style: { pickTitle: "2. Pick a Reel style", pickDescription: "This shapes cuts, transitions, zoom pacing, hook tone and music mood.", equipmentTitle: "3. Gear", equipmentDescription: "Analysis is complete. Continue directly with the gear settings.", selectedStyle: "Selected style:" },
    analysis: { title: "Analyzing your video", description: "Scanning real frames for motion, sharpness & exposure", fallback: "Real video analysis failed, falling back to mock moments" },
    render: { editing: "Editing your {style} montage…", processingRoute: "Preparing animated route map…", processingGear: "Preparing equipment summary card…", processingCuts: "Cutting, zooming & cross-fading your clips…", loading: "Loading editing engine…", retry: "Retry", continueRaw: "Continue with raw clip", error: "Couldn't render the montage on this device. You can retry, or continue with the raw clip." },
    preview: { ready: "Montage rendered — real cuts, zoom & transitions applied", readyAlt: "Analysis complete — your Reel is ready to preview", export: "Export", newReel: "Start a new Reel" },
    export: { quality: "Export quality", watermark: "Watermark", visible: "Visible on export", removed: "Removed", batch: "Batch export multiple Reels", comingSoon: "Coming soon", download: "Download MP4", rendering: "Rendering your Reel…", done: "Your Reel is ready — remember to add it to Instagram manually 🎉", removeWatermark: "Remove the watermark with Creator Pro" },
    pricing: { title: "Unlock ClipsyReel Pro", subtitle: "Create more, faster, without the watermark.", footer: "Cancel anytime. Prices shown in EUR. Payments are simulated in this MVP — Stripe Checkout integrates here later." },
    upgrade: { later: "Maybe later", seePlans: "See Pro plans" },
    story: { title: "Instagram Story cut", description: "A longer Story version sampled across your clips, capped at 60s (Instagram's Story limit).", create: "Create Story version", download: "Download Story MP4", regenerate: "Re-generate", usesCredit: "Uses the same weekly Reel credit as your main export.", error: "Couldn't render the Story on this device. Try shorter videos." },
    diagnostics: { title: "Render Diagnostics", totalTime: "Total Time", hardware: "Hardware", phase1: "Phase 1 (Cuts)", phase2: "Phase 2 (Compose)", performance: "Performance Score", gpuOn: "GPU Acceleration Active", cpuMode: "CPU Mode (consider upgrading GPU for faster renders)", bottlenecks: "Bottlenecks Detected", suggestions: "Suggestions", quality: "Render Quality", fast: "🚀 Fast", standard: "✨ Std", premium: "👑 Max", kenBurns: "Disable Ken Burns zoom in preview mode to render 30% faster", gpuAdvice: "Install NVIDIA drivers or upgrade GPU for hardware acceleration", previewAdvice: "Try preview quality mode for faster feedback" },
    common: { back: "Back", chooseStyle: "Choose a style", analyzeVideos: "Analyze video(s)", generateReel: "Generate Reel", startNew: "Start a new Reel", exportLabel: "Export", currentPlan: "Current plan" },
    music: { note: "ClipsyReel suggests the vibe — add this track manually inside Instagram before posting (music licensing stays on Instagram's side)." },
    renderNote: "Real cuts, zoom and transitions are being rendered on your device — no upload to a server needed.",
  },
  es: {
    shell: { free: "Gratis", title: "ClipsyReel", chooseLanguage: "Elegir idioma" },
    hero: { badge: "Creación de Reels con IA", titleTop: "Convierte cualquier vídeo en", titleBottom: "un Reel que detiene el scroll", description: "Sube tu MP4, elige un estilo y deja que ClipsyReel encuentre los mejores momentos, escriba tu hook y caption, y exporte un Reel 9:16 listo para publicar.", fast: "Rápido", ready: "Listo para 9:16", noSkills: "No necesitas saber editar" },
    reelName: { title: "1. Nombre del Reel", description: "Define el título, la tipografía y el tamaño antes de construir el resto de la historia.", typography: "Tipografía", letterSize: "Tamaño de letra", color: "Color", livePreview: "Vista previa en vivo", placeholder: "Escribe tu texto aquí", fontOptions: { cinematic: "Cinematográfico", modern: "Moderno", classic: "Clásico", bold: "Negrita", minimal: "Minimal", handwritten: "Manuscrita", elegant: "Elegante", impact: "Impacto", mono: "Mono", rounded: "Redondeado" }, sizeOptions: { sm: "Pequeño", md: "Mediano", lg: "Grande" } },
    upload: { title: "2. Subir vídeos", description: "Sube hasta 3 clips — se combinarán en un solo montaje.", add: "Añadir otro clip", combine: "Combina hasta 3 clips en un solo montaje", tap: "Toca para subir tu MP4", drag: "o arrastra y suelta · hasta 500 MB", ready: "listo para crear", max: "Máximo de {maxVideos} clips por montaje.", audioOn: "Audio activado", audioOff: "Audio desactivado", remove: "Eliminar vídeo", upload: "Subiendo…" },
    route: { title: "3. Ruta (opcional)", description: "Añade una ruta GPX o define origen/destino para una intro de mapa, o salta este paso.", lockedTitle: "Los mapas GPX son una función Pro", lockedMessage: "Sube tu archivo GPX o planifica una ruta por ciudades con Creator Pro.", import: "Importar GPX", plan: "Planificar ruta", modeTitle: "Importación GPX y planificador de ruta", modeDescription: "Sube un archivo GPX o planifica una ruta desde ciudades.", proBadge: "FUNCIÓN PRO", proCardTitle: "Importación GPX y planificador de ruta", proCardDescription: "Sube un archivo GPX o planifica una ruta desde ciudades con Creator Pro.", gpxTab: "Importar GPX", plannerTab: "Planificar ruta", departure: "Salida", destination: "Destino", stops: "Paradas", addStop: "Añadir parada", vehicle: "Vehículo", vehicleLabels: { car: "Coche", motorcycle: "Moto", bicycle: "Bicicleta", walking: "A pie" }, generate: "Generar ruta", generating: "Generando…", routeError: "No se pudo generar la ruta en este dispositivo.", locationMode: "Planificador", importMode: "GPX", gpxHint: "Suelta tu archivo GPX aquí o haz clic para elegirlo.", gpxSelected: "Archivo seleccionado", routeStats: "Estadísticas de ruta" },
    hook: { title: "4. Hook", description: "Configura los textos iniciales que captan la atención al comienzo de tu Reel." },
    style: { pickTitle: "2. Elige un estilo de Reel", pickDescription: "Esto define los cortes, transiciones, ritmo de zoom, tono del hook y ambiente musical.", equipmentTitle: "3. Equipo", equipmentDescription: "El análisis ha terminado. Continúa directamente con la configuración del equipo.", selectedStyle: "Estilo seleccionado:" },
    analysis: { title: "Analizando tu vídeo", description: "Buscando movimiento, nitidez y exposición en frames reales", fallback: "Falló el análisis real, usando momentos simulados" },
    render: { editing: "Editando tu montaje {style}…", processingRoute: "Preparando el mapa de ruta animado…", processingGear: "Preparando la tarjeta resumen del equipo…", processingCuts: "Cortando, acercando y cruzando tus clips…", loading: "Cargando el motor de edición…", retry: "Reintentar", continueRaw: "Continuar con el clip original", error: "No se pudo renderizar el montaje en este dispositivo. Puedes reintentar o continuar con el clip original." },
    preview: { ready: "Montaje renderizado — cortes, zoom y transiciones reales aplicados", readyAlt: "Análisis completo — tu Reel está listo para previsualizar", export: "Exportar", newReel: "Crear un nuevo Reel" },
    export: { quality: "Calidad de exportación", watermark: "Marca de agua", visible: "Visible al exportar", removed: "Eliminada", batch: "Exportar varios Reels", comingSoon: "Próximamente", download: "Descargar MP4", rendering: "Renderizando tu Reel…", done: "Tu Reel está listo — recuerda añadirlo manualmente a Instagram 🎉", removeWatermark: "Eliminar la marca de agua con Creator Pro" },
    pricing: { title: "Desbloquea ClipsyReel Pro", subtitle: "Crea más, más rápido y sin marca de agua.", footer: "Cancela cuando quieras. Los precios están en EUR. Los pagos están simulados en este MVP — Stripe Checkout se integrará más tarde." },
    upgrade: { later: "Quizá más tarde", seePlans: "Ver planes Pro" },
    story: { title: "Corte para Instagram Story", description: "Una versión Story más larga compuesta con tus clips, limitada a 60 s (límite de Instagram).", create: "Crear versión Story", download: "Descargar Story MP4", regenerate: "Regenerar", usesCredit: "Usa el mismo crédito semanal que tu exportación principal.", error: "No se pudo renderizar la Story en este dispositivo. Prueba con vídeos más cortos." },
    diagnostics: { title: "Diagnóstico de render", totalTime: "Tiempo total", hardware: "Hardware", phase1: "Fase 1 (cortes)", phase2: "Fase 2 (composición)", performance: "Puntuación de rendimiento", gpuOn: "Aceleración GPU activa", cpuMode: "Modo CPU (considera una GPU más rápida para renders más veloces)", bottlenecks: "Cuellos de botella detectados", suggestions: "Sugerencias", quality: "Calidad de render", fast: "🚀 Rápido", standard: "✨ Std", premium: "👑 Máx", kenBurns: "Desactiva el zoom Ken Burns en modo vista previa para renderizar 30% más rápido", gpuAdvice: "Instala los controladores NVIDIA o mejora la GPU para aceleración de hardware", previewAdvice: "Prueba el modo de vista previa para obtener feedback más rápido" },
    common: { back: "Atrás", chooseStyle: "Elegir un estilo", analyzeVideos: "Analizar vídeo(s)", generateReel: "Generar Reel", startNew: "Crear un nuevo Reel", exportLabel: "Exportar", currentPlan: "Plan actual" },
    music: { note: "ClipsyReel sugiere el ambiente — añade esta pista manualmente dentro de Instagram antes de publicar (la licencia musical sigue siendo de Instagram)." },
    renderNote: "Los cortes, zooms y transiciones se renderizan en tu dispositivo — no se sube nada a un servidor.",
  },
  it: {
    shell: { free: "Gratis", title: "ClipsyReel", chooseLanguage: "Scegli lingua" },
    hero: { badge: "Creazione Reel con IA", titleTop: "Trasforma qualsiasi video in", titleBottom: "un Reel che ferma lo scroll", description: "Carica il tuo MP4, scegli uno stile e lascia che ClipsyReel trovi i momenti migliori, scriva hook e caption ed esporti un Reel 9:16 pronto da pubblicare.", fast: "Veloce", ready: "Pronto per 9:16", noSkills: "Non servono competenze di montaggio" },
    reelName: { title: "1. Nome del Reel", description: "Imposta titolo, tipografia e dimensione prima di costruire il resto della storia.", typography: "Tipografia", letterSize: "Dimensione carattere", color: "Colore", livePreview: "Anteprima live", placeholder: "Scrivi il tuo testo qui", fontOptions: { cinematic: "Cinematografico", modern: "Moderno", classic: "Classico", bold: "Grassetto", minimal: "Minimal", handwritten: "Manoscritto", elegant: "Elegante", impact: "Impact", mono: "Mono", rounded: "Arrotondato" }, sizeOptions: { sm: "Piccolo", md: "Medio", lg: "Grande" } },
    upload: { title: "2. Carica video", description: "Carica fino a 3 clip — verranno unite in un unico montaggio.", add: "Aggiungi un altro clip", combine: "Unisci fino a 3 clip in un unico montaggio", tap: "Tocca per caricare il tuo MP4", drag: "oppure trascina e rilascia · fino a 500 MB", ready: "pronto da creare", max: "Massimo di {maxVideos} clip per montaggio.", audioOn: "Audio attivo", audioOff: "Audio disattivo", remove: "Rimuovi video", upload: "Caricamento…" },
    route: { title: "3. Percorso (opzionale)", description: "Aggiungi un percorso GPX o definisci partenza/destinazione per un’intro mappa, oppure salta questo passaggio.", lockedTitle: "Le mappe GPX sono una funzione Pro", lockedMessage: "Carica il file GPX o pianifica un percorso per città con Creator Pro.", import: "Importa GPX", plan: "Pianifica percorso", modeTitle: "Import GPX e pianificatore", modeDescription: "Carica un file GPX o pianifica un percorso dalle città.", proBadge: "FUNZIONE PRO", proCardTitle: "Import GPX e pianificatore", proCardDescription: "Carica un file GPX o pianifica un percorso dalle città con Creator Pro.", gpxTab: "Importa GPX", plannerTab: "Pianifica percorso", departure: "Partenza", destination: "Destinazione", stops: "Tappe", addStop: "Aggiungi tappa", vehicle: "Veicolo", vehicleLabels: { car: "Auto", motorcycle: "Moto", bicycle: "Bicicletta", walking: "A piedi" }, generate: "Genera percorso", generating: "Generazione…", routeError: "Impossibile generare il percorso su questo dispositivo.", locationMode: "Pianificatore", importMode: "GPX", gpxHint: "Trascina qui il file GPX o clicca per sceglierlo.", gpxSelected: "File selezionato", routeStats: "Statistiche percorso" },
    hook: { title: "4. Hook", description: "Configura i testi iniziali che catturano l’attenzione all’inizio del tuo Reel." },
    style: { pickTitle: "2. Scegli uno stile Reel", pickDescription: "Questo definisce tagli, transizioni, ritmo dello zoom, tono dell’hook e mood musicale.", equipmentTitle: "3. Equipaggiamento", equipmentDescription: "L’analisi è completata. Continua subito con le impostazioni dell’equipaggiamento.", selectedStyle: "Stile selezionato:" },
    analysis: { title: "Analisi del video", description: "Scansione di frame reali per movimento, nitidezza ed esposizione", fallback: "Analisi reale fallita, uso momenti simulati" },
    render: { editing: "Modifica del tuo montaggio {style}…", processingRoute: "Preparazione della mappa del percorso animata…", processingGear: "Preparazione della scheda riepilogo attrezzatura…", processingCuts: "Taglio, zoom e crossfade dei clip…", loading: "Caricamento del motore di editing…", retry: "Riprova", continueRaw: "Continua con il clip originale", error: "Impossibile renderizzare il montaggio su questo dispositivo. Puoi riprovare o continuare con il clip originale." },
    preview: { ready: "Montaggio renderizzato — tagli, zoom e transizioni reali applicati", readyAlt: "Analisi completata — il tuo Reel è pronto per l’anteprima", export: "Esporta", newReel: "Avvia un nuovo Reel" },
    export: { quality: "Qualità export", watermark: "Watermark", visible: "Visibile all’export", removed: "Rimosso", batch: "Esporta più Reel", comingSoon: "Prossimamente", download: "Scarica MP4", rendering: "Rendering del tuo Reel…", done: "Il tuo Reel è pronto — ricordati di caricarlo manualmente su Instagram 🎉", removeWatermark: "Rimuovi il watermark con Creator Pro" },
    pricing: { title: "Sblocca ClipsyReel Pro", subtitle: "Crea di più, più velocemente, senza watermark.", footer: "Cancella quando vuoi. I prezzi sono in EUR. I pagamenti sono simulati in questo MVP — Stripe Checkout sarà integrato più avanti." },
    upgrade: { later: "Forse più tardi", seePlans: "Vedi i piani Pro" },
    story: { title: "Montaggio Instagram Story", description: "Una versione Story più lunga, composta dai tuoi clip, limitata a 60 s (limite Instagram).", create: "Crea versione Story", download: "Scarica Story MP4", regenerate: "Rigenera", usesCredit: "Usa lo stesso credito settimanale del tuo export principale.", error: "Impossibile renderizzare la Story su questo dispositivo. Prova video più brevi." },
    diagnostics: { title: "Diagnostica render", totalTime: "Tempo totale", hardware: "Hardware", phase1: "Fase 1 (tagli)", phase2: "Fase 2 (composizione)", performance: "Punteggio prestazioni", gpuOn: "Accelerazione GPU attiva", cpuMode: "Modalità CPU (considera una GPU più veloce per render più rapidi)", bottlenecks: "Colli di bottiglia rilevati", suggestions: "Suggerimenti", quality: "Qualità render", fast: "🚀 Veloce", standard: "✨ Std", premium: "👑 Max", kenBurns: "Disattiva lo zoom Ken Burns in modalità anteprima per renderizzare il 30% più velocemente", gpuAdvice: "Installa i driver NVIDIA o aggiorna la GPU per l’accelerazione hardware", previewAdvice: "Prova la modalità anteprima per un feedback più rapido" },
    common: { back: "Indietro", chooseStyle: "Scegli uno stile", analyzeVideos: "Analizza video", generateReel: "Genera Reel", startNew: "Avvia un nuovo Reel", exportLabel: "Esporta", currentPlan: "Piano attuale" },
    music: { note: "ClipsyReel suggerisce il mood — aggiungi manualmente questo brano dentro Instagram prima di pubblicare (la licenza resta a Instagram)." },
    renderNote: "Tagli, zoom e transizioni vengono renderizzati sul tuo dispositivo — nessun upload a un server necessario.",
  },
  zh: {
    shell: { free: "免费版", title: "ClipsyReel", chooseLanguage: "选择语言" },
    hero: { badge: "AI 驱动的 Reel 创作", titleTop: "把任何视频变成", titleBottom: "让人停下滑动的 Reel", description: "上传 MP4，选择风格，让 ClipsyReel 帮你找到最佳片段、编写 hook 和 caption，并导出可直接发布的 9:16 Reel。", fast: "快速", ready: "支持 9:16", noSkills: "无需剪辑经验" },
    reelName: { title: "1. Reel 名称", description: "先设置标题、字体和字号，再构建整个故事。", typography: "字体", letterSize: "字号", color: "颜色", livePreview: "实时预览", placeholder: "在这里输入文本", fontOptions: { cinematic: "电影感", modern: "现代", classic: "经典", bold: "粗体", minimal: "极简", handwritten: "手写", elegant: "优雅", impact: "冲击", mono: "等宽", rounded: "圆润" }, sizeOptions: { sm: "小", md: "中", lg: "大" } },
    upload: { title: "2. 上传视频", description: "最多上传 3 个片段，它们会合成为一个蒙太奇。", add: "添加另一个片段", combine: "最多可将 3 个片段合成为一个蒙太奇", tap: "点击上传你的 MP4", drag: "或拖拽放入 · 最多 500MB", ready: "可开始创作", max: "每个蒙太奇最多 {maxVideos} 个片段。", audioOn: "音频开启", audioOff: "音频关闭", remove: "移除视频", upload: "上传中…" },
    route: { title: "3. 路线（可选）", description: "添加 GPX 路线或设置起点/终点作为地图开场，或跳过此步骤。", lockedTitle: "GPX 路线地图是 Pro 功能", lockedMessage: "使用 Creator Pro 上传 GPX 文件或按城市名称规划路线。", import: "导入 GPX", plan: "规划路线", modeTitle: "GPX 导入与路线规划", modeDescription: "上传 GPX 文件或按城市规划路线。", proBadge: "PRO 功能", proCardTitle: "GPX 导入与路线规划", proCardDescription: "使用 Creator Pro 上传 GPX 文件或按城市规划路线。", gpxTab: "导入 GPX", plannerTab: "规划路线", departure: "出发", destination: "目的地", stops: "途经点", addStop: "添加途经点", vehicle: "交通方式", vehicleLabels: { car: "汽车", motorcycle: "摩托车", bicycle: "自行车", walking: "步行" }, generate: "生成路线", generating: "生成中…", routeError: "此设备无法生成路线。", locationMode: "规划器", importMode: "GPX", gpxHint: "把 GPX 文件拖到这里，或点击选择。", gpxSelected: "已选文件", routeStats: "路线统计" },
    hook: { title: "4. Hook", description: "设置开场 Hook 文案，让 Reel 一开始就抓住注意力。" },
    style: { pickTitle: "2. 选择 Reel 风格", pickDescription: "这会影响剪切、转场、缩放节奏、Hook 语气和音乐氛围。", equipmentTitle: "3. 装备", equipmentDescription: "分析完成。现在继续设置装备。", selectedStyle: "已选择风格：" },
    analysis: { title: "正在分析你的视频", description: "扫描真实帧中的运动、清晰度和曝光", fallback: "真实视频分析失败，已回退到模拟片段" },
    render: { editing: "正在编辑你的 {style} 蒙太奇…", processingRoute: "正在准备动态路线地图…", processingGear: "正在准备装备总结卡片…", processingCuts: "正在剪切、缩放并交叉淡化片段…", loading: "正在加载剪辑引擎…", retry: "重试", continueRaw: "继续使用原始片段", error: "此设备无法渲染该蒙太奇。你可以重试，或继续使用原始片段。" },
    preview: { ready: "蒙太奇已渲染 — 已应用真实剪切、缩放和转场", readyAlt: "分析完成 — 你的 Reel 已可预览", export: "导出", newReel: "创建新的 Reel" },
    export: { quality: "导出质量", watermark: "水印", visible: "导出时可见", removed: "已移除", batch: "批量导出多个 Reel", comingSoon: "即将推出", download: "下载 MP4", rendering: "正在渲染你的 Reel…", done: "你的 Reel 已准备好 — 记得手动上传到 Instagram 🎉", removeWatermark: "使用 Creator Pro 移除水印" },
    pricing: { title: "解锁 ClipsyReel Pro", subtitle: "创作更多、更快，并去除水印。", footer: "可随时取消。价格以 EUR 显示。此 MVP 中的付款为模拟——稍后会接入 Stripe Checkout。" },
    upgrade: { later: "稍后再说", seePlans: "查看 Pro 方案" },
    story: { title: "Instagram Story 剪辑", description: "基于你的片段生成更长的 Story 版本，最多 60 秒（Instagram 限制）。", create: "创建 Story 版本", download: "下载 Story MP4", regenerate: "重新生成", usesCredit: "与主导出共享同一个每周 Reel 配额。", error: "无法在此设备上渲染 Story。请尝试更短的视频。" },
    diagnostics: { title: "渲染诊断", totalTime: "总耗时", hardware: "硬件", phase1: "阶段 1（剪切）", phase2: "阶段 2（合成）", performance: "性能评分", gpuOn: "GPU 加速已启用", cpuMode: "CPU 模式（建议更快的 GPU 以提升渲染速度）", bottlenecks: "检测到的瓶颈", suggestions: "建议", quality: "渲染质量", fast: "🚀 快速", standard: "✨ 标准", premium: "👑 最高", kenBurns: "在预览模式下关闭 Ken Burns 缩放可快 30% 渲染", gpuAdvice: "安装 NVIDIA 驱动或升级 GPU 以启用硬件加速", previewAdvice: "试试预览质量模式以获得更快反馈" },
    common: { back: "返回", chooseStyle: "选择风格", analyzeVideos: "分析视频", generateReel: "生成 Reel", startNew: "创建新的 Reel", exportLabel: "导出", currentPlan: "当前方案" },
    music: { note: "ClipsyReel 会推荐氛围——发布前请手动在 Instagram 中添加这首音乐（音乐版权仍归 Instagram 侧）。" },
    renderNote: "所有剪切、缩放和转场都在你的设备上渲染——不会上传到服务器。",
  },
} as const;

function buildCopy(locale: Locale) {
  const base = COPY[locale];
  return {
    ...base,
    languageLabel: LANGUAGE_LABELS[locale],
    stepLabel: (step: AppStep) => STEP_LABELS[locale][step],
    styleText: base.style,
    style: (style: ReelStyle) => STYLE_COPY[locale][style],
    plan: (plan: PlanId) => PLAN_COPY[locale][plan],
    analysisSteps: ANALYSIS_STEPS[locale],
    gear: {
      title: {
        fr: "5. Équipements",
        de: "5. Ausrüstung",
        en: "5. Gear",
        es: "5. Equipo",
        it: "5. Equipaggiamento",
        zh: "5. 装备",
      }[locale],
      photoTitle: {
        fr: "Ajouter une photo moto",
        de: "Motorradfoto hinzufügen",
        en: "Add a bike photo",
        es: "Añadir una foto de la moto",
        it: "Aggiungi una foto della moto",
        zh: "添加摩托车照片",
      }[locale],
      photoDescription: {
        fr: "Importe une image de toi avec ta moto pour que la carte de fin combine la photo et ta liste d’équipements.",
        de: "Lade ein Foto von dir mit deinem Motorrad hoch, damit die Schlusskarte Foto und Ausrüstung kombiniert.",
        en: "Upload a photo of you with your bike so the end card combines the image and your gear list.",
        es: "Sube una foto tuya con la moto para que la tarjeta final combine la imagen y tu lista de equipo.",
        it: "Carica una foto di te con la moto così la card finale unisce l'immagine e la tua lista di equipaggiamento.",
        zh: "上传你和摩托车的照片，让结尾卡片把图片与你的装备列表合在一起。",
      }[locale],
      uploadPhoto: {
        fr: "Choisir une photo",
        de: "Foto auswählen",
        en: "Choose a photo",
        es: "Elegir una foto",
        it: "Scegli una foto",
        zh: "选择照片",
      }[locale],
      changePhoto: {
        fr: "Remplacer la photo",
        de: "Foto ersetzen",
        en: "Replace photo",
        es: "Cambiar foto",
        it: "Sostituisci foto",
        zh: "更换照片",
      }[locale],
      removePhoto: {
        fr: "Supprimer",
        de: "Entfernen",
        en: "Remove",
        es: "Eliminar",
        it: "Rimuovi",
        zh: "移除",
      }[locale],
      photoReady: {
        fr: "Photo prête",
        de: "Foto bereit",
        en: "Photo ready",
        es: "Foto lista",
        it: "Foto pronta",
        zh: "照片已就绪",
      }[locale],
      brand: {
        fr: "Marque",
        de: "Marke",
        en: "Brand",
        es: "Marca",
        it: "Marca",
        zh: "品牌",
      }[locale],
      model: {
        fr: "Modèle proposé",
        de: "Vorgeschlagenes Modell",
        en: "Suggested model",
        es: "Modelo sugerido",
        it: "Modello suggerito",
        zh: "推荐型号",
      }[locale],
      chooseBrandFirst: {
        fr: "Choisis d'abord une marque",
        de: "Wähle zuerst eine Marke",
        en: "Choose a brand first",
        es: "Elige primero una marca",
        it: "Scegli prima una marca",
        zh: "请先选择品牌",
      }[locale],
      chooseModel: {
        fr: "Choisir un modèle",
        de: "Modell wählen",
        en: "Choose a model",
        es: "Elegir un modelo",
        it: "Scegli un modello",
        zh: "选择型号",
      }[locale],
    },
    gearLabel: (key: GearCategoryKey) =>
      ({
        fr: { motorcycle: "Moto", tires: "Pneu", helmet: "Casque", jacket: "Veste", pants: "Pantalon", luggage: "Bagages", camera: "Camera", drone: "Drone", navigation: "Navigation" },
        de: { motorcycle: "Motorrad", tires: "Reifen", helmet: "Helm", jacket: "Jacke", pants: "Hose", luggage: "Gepäck", camera: "Kamera", drone: "Drohne", navigation: "Navigation" },
        en: { motorcycle: "Motorcycle", tires: "Tires", helmet: "Helmet", jacket: "Jacket", pants: "Pants", luggage: "Luggage", camera: "Camera", drone: "Drone", navigation: "Navigation" },
        es: { motorcycle: "Moto", tires: "Neumáticos", helmet: "Casco", jacket: "Chaqueta", pants: "Pantalón", luggage: "Equipaje", camera: "Cámara", drone: "Drone", navigation: "Navegación" },
        it: { motorcycle: "Moto", tires: "Pneumatici", helmet: "Casco", jacket: "Giacca", pants: "Pantaloni", luggage: "Bagagli", camera: "Camera", drone: "Drone", navigation: "Navigazione" },
        zh: { motorcycle: "摩托车", tires: "轮胎", helmet: "头盔", jacket: "外套", pants: "裤子", luggage: "行李", camera: "相机", drone: "无人机", navigation: "导航" },
      })[locale][key],
    renderMessages: [
      base.render.processingRoute,
      base.render.processingGear,
      base.render.processingCuts,
      base.render.loading,
    ],
  };
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  copy: Copy;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem("clipsyreel-locale");
    let resolved: Locale = "fr";

    if (stored && ["fr", "de", "en", "es", "it", "zh"].includes(stored)) {
      resolved = stored as Locale;
    } else {
      const browser = window.navigator.language.slice(0, 2).toLowerCase();
      if (browser === "de" || browser === "en" || browser === "es" || browser === "it" || browser === "zh") {
        resolved = browser as Locale;
      }
    }

    setLocale(resolved);
    window.localStorage.setItem("clipsyreel-locale", resolved);
    document.documentElement.lang = localeToHtmlLang[resolved];
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("clipsyreel-locale", locale);
    document.documentElement.lang = localeToHtmlLang[locale];
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, copy: buildCopy(locale) }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
