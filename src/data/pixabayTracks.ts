import { ReelStyle } from "@/types";

/**
 * Real, royalty-free preview tracks sourced from Pixabay Music
 * (https://pixabay.com/music/), one per Reel style, picked by ear to match
 * that style's rhythm/mood in `MUSIC_BY_STYLE` (src/data/mock.ts).
 *
 * IMPORTANT — preview only, never exported:
 * These MP3s are played back client-side purely so the user can *feel* the
 * pacing of a real track while previewing their Reel. They are NEVER mixed
 * into the ffmpeg.wasm render pipeline (video-engine.ts) or the exported
 * MP4. Per Pixabay's license, users must still add music manually inside
 * Instagram itself before posting (Instagram's own licensed audio library),
 * exactly like the previous procedurally-synthesized placeholder.
 *
 * Pixabay's content pages sit behind a Cloudflare bot-challenge, so this
 * list was curated by hand (one real, verified-playable CDN URL per style)
 * rather than scraped live at runtime — the app never scrapes Pixabay
 * itself, it just links to/plays these pre-selected, known-good URLs.
 *
 * FUTURE INTEGRATION: swap this static table for a real search against
 * Pixabay's official Content API (https://pixabay.com/api/docs/#api_music)
 * once an API key is available, or a licensed catalog like Epidemic Sound.
 */
export interface PixabayTrack {
  title: string;
  artist: string;
  /** Direct, CORS-safe-to-play (no fetch/decode needed) MP3 URL on Pixabay's CDN. */
  mp3Url: string;
  /** Pixabay track page, for attribution / "view on Pixabay" links. */
  pageUrl: string;
}

export const PIXABAY_TRACKS: Record<ReelStyle, PixabayTrack> = {
  viral: {
    title: "Energetic Pop",
    artist: "JonasBlakewood",
    mp3Url: "https://cdn.pixabay.com/audio/2026/07/06/audio_861793bc24.mp3",
    pageUrl: "https://pixabay.com/music/dance-energetic-pop-562841/",
  },
  travel: {
    title: "Happy Together - Food Vlog Travel Music",
    artist: "SunnyVibesAudio",
    mp3Url: "https://cdn.pixabay.com/audio/2024/10/04/audio_77997f7fe5.mp3",
    pageUrl: "https://pixabay.com/music/happy-childrens-tunes-happy-together-food-vlog-travel-music-247319/",
  },
  adventure: {
    title: "Orchestral",
    artist: "PaulYudin",
    mp3Url: "https://cdn.pixabay.com/audio/2026/04/13/audio_339e92e1e4.mp3",
    pageUrl: "https://pixabay.com/music/adventure-orchestral-518713/",
  },
  sport: {
    title: "Energetic Action Sport",
    artist: "AlexGrohl",
    mp3Url: "https://cdn.pixabay.com/audio/2026/03/12/audio_bea8e8877a.mp3",
    pageUrl: "https://pixabay.com/music/rock-energetic-action-sport-500409/",
  },
  cinematic: {
    title: "Epic - Cinematic Epic",
    artist: "PaulYudin",
    mp3Url: "https://cdn.pixabay.com/audio/2026/02/10/audio_c28c6de8cc.mp3",
    pageUrl: "https://pixabay.com/music/adventure-epic-cinematic-epic-482367/",
  },
  luxury: {
    title: "Luxury - Luxury Music",
    artist: "PaulYudin",
    mp3Url: "https://cdn.pixabay.com/audio/2026/07/25/audio_a5ae1921aa.mp3",
    pageUrl: "https://pixabay.com/music/modern-classical-luxury-luxury-music-573998/",
  },
};
