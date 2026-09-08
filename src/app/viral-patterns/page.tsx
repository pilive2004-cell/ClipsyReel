"use client";

import { useMemo, useState } from "react";
import { PatternLibrary } from "@/modules/viral-patterns/PatternLibrary";
import { analyzeReferenceVideo } from "@/modules/viral-patterns/ViralPatternAnalyzer";
import { PatternMixer } from "@/modules/viral-patterns/PatternMixer";
import { calculateMontageQualityScore } from "@/modules/viral-patterns/MontageQualityScorer";
import {
  EnergyLevel,
  MontageFormat,
  MontagePattern,
  MontageRecipeInput,
  MontageStyleTag,
  PatternMixResult,
  ViralPatternAnalysisResult,
  VideoType,
} from "@/modules/viral-patterns/types";
import ViralEmotionalCurveChart from "@/components/viral-patterns/ViralEmotionalCurveChart";

const VIDEO_TYPES: VideoType[] = ["motorcycle", "road_trip", "travel", "offroad", "drone", "city", "mountain"];
const ENERGY_LEVELS: EnergyLevel[] = ["calm", "balanced", "dynamic", "extreme"];
const FORMATS: MontageFormat[] = ["9:16", "16:9", "1:1"];
const STYLES: MontageStyleTag[] = ["cinematic", "viral", "premium", "adventure", "emotional"];
const DURATIONS: MontageRecipeInput["desiredDurationSeconds"][] = [15, 30, 45, 60];

export default function ViralPatternsPage() {
  const [library] = useState<PatternLibrary>(() => new PatternLibrary());
  const [mixer] = useState<PatternMixer>(() => new PatternMixer(library));

  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<ViralPatternAnalysisResult[]>([]);
  const [allPatterns, setAllPatterns] = useState<MontagePattern[]>(() => library.all());

  const [input, setInput] = useState<MontageRecipeInput>({
    desiredDurationSeconds: 30,
    videoType: "motorcycle",
    desiredEnergy: "dynamic",
    format: "9:16",
    gpxAvailable: false,
    musicAvailable: true,
    bestMomentsCount: 3,
    style: "adventure",
  });

  const [recentSignatures, setRecentSignatures] = useState<string[]>([]);
  const [mixResult, setMixResult] = useState<PatternMixResult | null>(null);
  const [applyNote, setApplyNote] = useState<string | null>(null);

  const quality = useMemo(() => {
    if (!mixResult) return null;
    return calculateMontageQualityScore(mixResult.recipe, { coherenceScore: mixResult.coherenceScore });
  }, [mixResult]);

  const transitionUsage = useMemo(() => {
    const counts = new Map<string, number>();
    analysisResults.forEach((r) => r.transitions.forEach((t) => counts.set(t.transitionType, (counts.get(t.transitionType) ?? 0) + 1)));
    allPatterns.forEach((p) => p.transitionStyle.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [analysisResults, allPatterns]);

  function handleFilesSelected(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list));
  }

  async function handleAnalyze() {
    if (files.length === 0) return;
    setAnalyzing(true);
    setApplyNote(null);
    try {
      const results: ViralPatternAnalysisResult[] = [];
      for (const file of files) {
        const result = await analyzeReferenceVideo(file);
        library.add(result.derivedPattern);
        results.push(result);
      }
      setAnalysisResults((prev) => [...results, ...prev]);
      setAllPatterns(library.all());
    } finally {
      setAnalyzing(false);
    }
  }

  function handleGenerateRecipe() {
    const result = mixer.mix(input, { recentSignatures });
    setMixResult(result);
    setRecentSignatures((prev) => [result.recipe.editingSignature, ...prev].slice(0, 10));
    setApplyNote(null);
  }

  function handleApplyToMyVideo() {
    if (!mixResult) return;
    setApplyNote(
      "Prochainement : cette recette sera appliquée automatiquement à votre vidéo via le moteur de rendu principal. Pour l'instant, ceci est une démonstration isolée du module ViralPatternLibrary."
    );
  }

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">ViralPatternLibrary — Test UI</h1>
          <p className="mt-2 text-sm text-white/60">
            Module expérimental et isolé pour analyser des structures de montage abstraites (rythme, hook, transitions,
            courbe émotionnelle) et générer des recettes de montage variées. Aucune vidéo tierce n&apos;est téléchargée
            ou copiée — seules les vidéos que vous importez vous-même ici sont analysées, et seules des métriques
            abstraites sont conservées.
          </p>
        </header>

        {/* 1. Import reference videos + analyze */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white/80">1. Importer des vidéos de référence (les vôtres uniquement)</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium hover:bg-white/10">
              Choisir des fichiers vidéo
              <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
            </label>
            <span className="text-xs text-white/50">{files.length > 0 ? `${files.length} fichier(s) sélectionné(s)` : "Aucun fichier sélectionné"}</span>
            <button
              onClick={handleAnalyze}
              disabled={files.length === 0 || analyzing}
              className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40"
            >
              {analyzing ? "Analyse en cours…" : "Analyze Viral Structure"}
            </button>
          </div>

          {analysisResults.length > 0 && (
            <div className="mt-5 space-y-4">
              {analysisResults.map((r, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-semibold text-white/80">{r.sourceFileName}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/60 sm:grid-cols-4">
                    <div>Durée: {r.structure.totalDurationSeconds}s</div>
                    <div>Plans: {r.structure.shotCount}</div>
                    <div>Coupes/s: {r.structure.cutsPerSecond}</div>
                    <div>Hook score: {r.hook.hookScore}/100</div>
                    <div>Fin: {r.structure.endingType}</div>
                    <div>BPM estimé: {r.audioSync.estimatedBpm}</div>
                    <div>Fast cut ratio: {r.rhythm.fastCutRatio}</div>
                    <div>Pattern dérivé: {r.derivedPattern.category}</div>
                  </div>
                  <div className="mt-3">
                    <ViralEmotionalCurveChart curve={r.emotionalCurve} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. Pattern library */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white/80">2. Bibliothèque de patterns ({allPatterns.length})</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {allPatterns.map((p) => (
              <div key={p.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-[11px]">
                <p className="font-semibold text-white/80">{p.name}</p>
                <p className="text-white/50">
                  {p.category} · {p.sourceType} · énergie {p.energyProfile} · {p.durationRange[0]}-{p.durationRange[1]}s
                </p>
                <p className="mt-1 text-white/40">Premium: {p.premiumScore} · Unicité: {p.uniquenessScore}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-xs font-semibold text-white/70">Transitions les plus utilisées</h3>
          <table className="mt-2 w-full text-left text-[11px] text-white/60">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="py-1 pr-4">Transition</th>
                <th className="py-1">Occurrences</th>
              </tr>
            </thead>
            <tbody>
              {transitionUsage.map(([t, count]) => (
                <tr key={t} className="border-b border-white/5">
                  <td className="py-1 pr-4">{t}</td>
                  <td className="py-1">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 3. Recipe generator */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white/80">3. Générer une recette de montage</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Durée">
              <select
                className="w-full rounded-md bg-black/30 px-2 py-1 text-xs"
                value={input.desiredDurationSeconds}
                onChange={(e) => setInput((s) => ({ ...s, desiredDurationSeconds: Number(e.target.value) as MontageRecipeInput["desiredDurationSeconds"] }))}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type de vidéo">
              <select
                className="w-full rounded-md bg-black/30 px-2 py-1 text-xs"
                value={input.videoType}
                onChange={(e) => setInput((s) => ({ ...s, videoType: e.target.value as VideoType }))}
              >
                {VIDEO_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Énergie">
              <select
                className="w-full rounded-md bg-black/30 px-2 py-1 text-xs"
                value={input.desiredEnergy}
                onChange={(e) => setInput((s) => ({ ...s, desiredEnergy: e.target.value as EnergyLevel }))}
              >
                {ENERGY_LEVELS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Format">
              <select
                className="w-full rounded-md bg-black/30 px-2 py-1 text-xs"
                value={input.format}
                onChange={(e) => setInput((s) => ({ ...s, format: e.target.value as MontageFormat }))}
              >
                {FORMATS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Style">
              <select
                className="w-full rounded-md bg-black/30 px-2 py-1 text-xs"
                value={input.style}
                onChange={(e) => setInput((s) => ({ ...s, style: e.target.value as MontageStyleTag }))}
              >
                {STYLES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="GPX disponible">
              <input type="checkbox" checked={input.gpxAvailable} onChange={(e) => setInput((s) => ({ ...s, gpxAvailable: e.target.checked }))} />
            </Field>
            <Field label="Musique disponible">
              <input type="checkbox" checked={input.musicAvailable} onChange={(e) => setInput((s) => ({ ...s, musicAvailable: e.target.checked }))} />
            </Field>
            <Field label="Meilleurs moments détectés">
              <input
                type="number"
                min={0}
                className="w-full rounded-md bg-black/30 px-2 py-1 text-xs"
                value={input.bestMomentsCount}
                onChange={(e) => setInput((s) => ({ ...s, bestMomentsCount: Number(e.target.value) }))}
              />
            </Field>
          </div>

          <button onClick={handleGenerateRecipe} className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-black">
            Generate Montage Recipe
          </button>

          {mixResult && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white/90">{mixResult.recipe.recipeName}</p>
                <p className="text-[11px] text-white/50">
                  Durée: {mixResult.recipe.duration}s · Ouverture: {mixResult.recipe.openingStrategy} · Cohérence: {mixResult.coherenceScore}/100
                </p>
                <table className="mt-3 w-full text-left text-[11px] text-white/60">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40">
                      <th className="py-1 pr-3">Segment</th>
                      <th className="py-1 pr-3">Début</th>
                      <th className="py-1 pr-3">Fin</th>
                      <th className="py-1 pr-3">Plan</th>
                      <th className="py-1 pr-3">Transition sortante</th>
                      <th className="py-1">Énergie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mixResult.recipe.timeline.map((seg, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-1 pr-3">{seg.segmentType}</td>
                        <td className="py-1 pr-3">{seg.start}s</td>
                        <td className="py-1 pr-3">{seg.end}s</td>
                        <td className="py-1 pr-3">{seg.shotType}</td>
                        <td className="py-1 pr-3">{seg.transitionOut}</td>
                        <td className="py-1">{seg.energy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="mt-3 list-inside list-disc text-[11px] text-white/50">
                  {mixResult.variationNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>

              {quality && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white/90">Score qualité global : {quality.overallScore}/100</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/60 sm:grid-cols-4">
                    {Object.entries(quality.breakdown).map(([k, v]) => (
                      <div key={k}>
                        {k}: {v}
                      </div>
                    ))}
                  </div>
                  {quality.recommendations.length > 0 && (
                    <ul className="mt-3 list-inside list-disc text-[11px] text-white/50">
                      {quality.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button onClick={handleApplyToMyVideo} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black">
                Apply to My Video
              </button>
              {applyNote && <p className="text-[11px] text-white/50">{applyNote}</p>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] text-white/50">
      {label}
      {children}
    </label>
  );
}
