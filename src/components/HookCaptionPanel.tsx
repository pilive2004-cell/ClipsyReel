"use client";

import { useState } from "react";
import { Check, Copy, Lock, PenLine, RefreshCcw } from "lucide-react";
import { CaptionVariant, HookVariant } from "@/types";
import { usePlan } from "@/lib/plan-context";
import { cn } from "@/lib/utils";

/** Sentinel ids used to represent "the user's own custom text is selected" — kept out of the AI-generated `hooks`/`captions` arrays so they don't collide with real variant ids. */
export const CUSTOM_HOOK_ID = "custom-hook";
export const CUSTOM_CAPTION_ID = "custom-caption";

interface HookCaptionPanelProps {
  hooks: HookVariant[];
  captions: CaptionVariant[];
  hashtags: string[];
  selectedHookId: string;
  selectedCaptionId: string;
  onSelectHook: (id: string) => void;
  onSelectCaption: (id: string) => void;
  onLockedClick: () => void;
  /** Free-text alternative to the AI-generated hook/caption variants — available on every plan. */
  customHookText: string;
  customCaptionText: string;
  onCustomHookChange: (text: string) => void;
  onCustomCaptionChange: (text: string) => void;
}

function useCopied() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };
  return { copiedKey, copy };
}

export default function HookCaptionPanel({
  hooks,
  captions,
  hashtags,
  selectedHookId,
  selectedCaptionId,
  onSelectHook,
  onSelectCaption,
  onLockedClick,
  customHookText,
  customCaptionText,
  onCustomHookChange,
  onCustomCaptionChange,
}: HookCaptionPanelProps) {
  const { isFree } = usePlan();
  const { copiedKey, copy } = useCopied();

  // Free plan: only the first hook/caption variant is unlocked, rest require Pro.
  const isHookLocked = (idx: number) => isFree && idx > 0;
  const isCaptionLocked = (idx: number) => isFree && idx > 0;

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/85">Hook text</h3>
          {isFree && (
            <span className="text-[10px] text-white/35">1 of {hooks.length} variants · Pro unlocks all</span>
          )}
        </div>
        <div className="space-y-2">
          {hooks.map((h, idx) => {
            const locked = isHookLocked(idx);
            const selected = selectedHookId === h.id;
            return (
              <button
                key={h.id}
                onClick={() => (locked ? onLockedClick() : onSelectHook(h.id))}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition",
                  selected ? "border-fuchsia-400/50 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                  locked && "opacity-50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-fuchsia-400 bg-fuchsia-400" : "border-white/25"
                  )}
                >
                  {selected && <Check className="h-2.5 w-2.5 text-black" />}
                </span>
                <span className="flex-1 text-white/80">{h.text}</span>
                {locked && <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />}
              </button>
            );
          })}
        </div>

        <CustomTextField
          kind="hook"
          placeholder="Write your own hook…"
          value={customHookText}
          onChange={onCustomHookChange}
          selected={selectedHookId === CUSTOM_HOOK_ID}
          onSelect={() => onSelectHook(CUSTOM_HOOK_ID)}
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white/85">Caption</h3>
        <div className="space-y-2">
          {captions.map((c, idx) => {
            const locked = isCaptionLocked(idx);
            const selected = selectedCaptionId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-xs transition",
                  selected ? "border-fuchsia-400/50 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.02]",
                  locked && "opacity-50"
                )}
              >
                <button
                  onClick={() => (locked ? onLockedClick() : onSelectCaption(c.id))}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-fuchsia-400 bg-fuchsia-400" : "border-white/25"
                    )}
                  >
                    {selected && <Check className="h-2.5 w-2.5 text-black" />}
                  </span>
                  <span className="flex-1 text-white/80">{c.text}</span>
                  {locked && <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />}
                </button>
                {!locked && (
                  <button
                    onClick={() => copy(c.id, c.text)}
                    className="mt-2 flex items-center gap-1 text-[10px] font-medium text-white/40 hover:text-white/70"
                  >
                    {copiedKey === c.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedKey === c.id ? "Copied" : "Copy caption"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <CustomTextField
          kind="caption"
          placeholder="Write your own caption…"
          value={customCaptionText}
          onChange={onCustomCaptionChange}
          selected={selectedCaptionId === CUSTOM_CAPTION_ID}
          onSelect={() => onSelectCaption(CUSTOM_CAPTION_ID)}
          multiline
        />
      </section>


      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/85">Hashtags</h3>
          <button
            onClick={() => copy("hashtags", hashtags.join(" "))}
            className="flex items-center gap-1 text-[10px] font-medium text-white/40 hover:text-white/70"
          >
            {copiedKey === "hashtags" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copiedKey === "hashtags" ? "Copied" : "Copy all"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {isFree && (
        <button
          onClick={onLockedClick}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2 text-[11px] font-medium text-white/50 hover:border-white/25 hover:text-white/70"
        >
          <RefreshCcw className="h-3 w-3" /> Unlock more hook &amp; caption variants with Pro
        </button>
      )}
    </div>
  );
}

interface CustomTextFieldProps {
  kind: "hook" | "caption";
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  selected: boolean;
  onSelect: () => void;
  multiline?: boolean;
}

/**
 * Free-text alternative row shown under both the hook and caption variant
 * lists — lets the user write their own wording instead of picking one of
 * the AI-generated options. Typing auto-selects it as the active choice
 * (matching the "one-click select" feel of the generated variants), and it
 * stays available to every plan (not gated behind Pro).
 */
function CustomTextField({ kind, placeholder, value, onChange, selected, onSelect, multiline }: CustomTextFieldProps) {
  const Field = multiline ? "textarea" : "input";
  return (
    <div
      className={cn(
        "mt-2 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs transition",
        selected ? "border-fuchsia-400/50 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.02]"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-fuchsia-400 bg-fuchsia-400" : "border-white/25"
        )}
      >
        {selected && <Check className="h-2.5 w-2.5 text-black" />}
      </span>
      <PenLine className="mt-0.5 h-3 w-3 shrink-0 text-white/30" />
      <Field
        value={value}
        placeholder={placeholder}
        aria-label={`Custom ${kind} text`}
        rows={multiline ? 2 : undefined}
        onFocus={onSelect}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          onChange(e.target.value);
          onSelect();
        }}
        className="flex-1 resize-none bg-transparent text-white/80 placeholder:text-white/25 focus:outline-none"
      />
    </div>
  );
}
