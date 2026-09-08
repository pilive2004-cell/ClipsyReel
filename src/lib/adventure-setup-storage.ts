"use client";

import { AdventureSetup, AdventureSetupDraftRecord } from "@/types";

const STORAGE_KEY = "clipsyreel:adventure-setup-drafts";

interface SaveAdventureSetupDraftParams {
  sessionKey: string;
  routeLabel: string | null;
  videoFingerprints: string[];
  setup: AdventureSetup;
}

interface SaveAdventureSetupDraftResult {
  storedLocally: boolean;
  syncedToSupabase: boolean;
  updatedAt: string;
}

function readLocalDraftMap(): Record<string, AdventureSetupDraftRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AdventureSetupDraftRecord>) : {};
  } catch (error) {
    console.warn("Failed to read local adventure setup drafts", error);
    return {};
  }
}

function writeLocalDraftMap(map: Record<string, AdventureSetupDraftRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("Failed to write local adventure setup drafts", error);
  }
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return {
    url,
    anonKey,
    table: process.env.NEXT_PUBLIC_SUPABASE_ADVENTURE_SETUPS_TABLE?.trim() || "adventure_setups",
  };
}

async function saveDraftToSupabase(record: AdventureSetupDraftRecord) {
  const config = getSupabaseConfig();
  if (!config) return false;

  const response = await fetch(`${config.url}/rest/v1/${config.table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([
      {
        session_key: record.sessionKey,
        route_label: record.routeLabel,
        video_fingerprints: record.videoFingerprints,
        setup_json: record.setup,
        updated_at: record.updatedAt,
      },
    ]),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase save failed (${response.status}): ${body}`);
  }

  return true;
}

async function loadDraftFromSupabase(sessionKey: string): Promise<AdventureSetupDraftRecord | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const query = new URLSearchParams({
    select: "session_key,route_label,video_fingerprints,setup_json,updated_at",
    session_key: `eq.${sessionKey}`,
    order: "updated_at.desc",
    limit: "1",
  });

  const response = await fetch(`${config.url}/rest/v1/${config.table}?${query.toString()}`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase load failed (${response.status}): ${body}`);
  }

  const rows = (await response.json()) as Array<{
    session_key: string;
    route_label: string | null;
    video_fingerprints: string[] | null;
    setup_json: AdventureSetup;
    updated_at: string;
  }>;

  const row = rows[0];
  if (!row) return null;

  return {
    sessionKey: row.session_key,
    routeLabel: row.route_label,
    videoFingerprints: row.video_fingerprints ?? [],
    setup: row.setup_json,
    updatedAt: row.updated_at,
  };
}

export async function loadAdventureSetupDraft(sessionKey: string): Promise<AdventureSetupDraftRecord | null> {
  if (!sessionKey) return null;

  const localDraft = readLocalDraftMap()[sessionKey] ?? null;
  let remoteDraft: AdventureSetupDraftRecord | null = null;

  try {
    remoteDraft = await loadDraftFromSupabase(sessionKey);
  } catch (error) {
    console.warn("Failed to load adventure setup draft from Supabase", error);
  }

  const chosen =
    localDraft && remoteDraft
      ? new Date(localDraft.updatedAt).getTime() >= new Date(remoteDraft.updatedAt).getTime()
        ? localDraft
        : remoteDraft
      : localDraft ?? remoteDraft;

  if (chosen && (!localDraft || localDraft.updatedAt !== chosen.updatedAt)) {
    const map = readLocalDraftMap();
    map[sessionKey] = chosen;
    writeLocalDraftMap(map);
  }

  return chosen;
}

export async function saveAdventureSetupDraft({
  sessionKey,
  routeLabel,
  videoFingerprints,
  setup,
}: SaveAdventureSetupDraftParams): Promise<SaveAdventureSetupDraftResult> {
  const updatedAt = new Date().toISOString();
  const record: AdventureSetupDraftRecord = {
    sessionKey,
    routeLabel,
    videoFingerprints,
    setup,
    updatedAt,
  };

  const map = readLocalDraftMap();
  map[sessionKey] = record;
  writeLocalDraftMap(map);

  let syncedToSupabase = false;
  try {
    syncedToSupabase = await saveDraftToSupabase(record);
  } catch (error) {
    console.warn("Failed to sync adventure setup draft to Supabase", error);
  }

  return {
    storedLocally: true,
    syncedToSupabase,
    updatedAt,
  };
}
