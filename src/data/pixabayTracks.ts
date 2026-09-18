import { ReelStyle } from "@/types";

/**
 * Real, royalty-free preview tracks sourced from Pixabay Music
 * (https://pixabay.com/music/), curated into a small per-style shortlist picked
 * by ear to match that style's rhythm/mood in `MUSIC_BY_STYLE` (src/data/mock.ts).
 *
 * These MP3s are used by the local app as high-quality style-matched music
 * sources for preview and optional export, so users hear a real musical bed
 * instead of a low-quality synthetic placeholder.
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
  energy: "low" | "medium" | "high";
  bestForSeconds: [number, number];
}

export const PIXABAY_TRACKS: Record<ReelStyle, PixabayTrack[]> = {
  viral: [
    {
      title: "Energetic Pop",
      artist: "JonasBlakewood",
      mp3Url: "https://cdn.pixabay.com/audio/2026/07/06/audio_861793bc24.mp3",
      pageUrl: "https://pixabay.com/music/dance-energetic-pop-562841/",
      energy: "high",
      bestForSeconds: [10, 35],
    },
    {
      title: "Happy Together - Food Vlog Travel Music",
      artist: "SunnyVibesAudio",
      mp3Url: "https://cdn.pixabay.com/audio/2024/10/04/audio_77997f7fe5.mp3",
      pageUrl: "https://pixabay.com/music/happy-childrens-tunes-happy-together-food-vlog-travel-music-247319/",
      energy: "medium",
      bestForSeconds: [20, 60],
    },
    {
      title: "Energetic Action Sport",
      artist: "AlexGrohl",
      mp3Url: "https://cdn.pixabay.com/audio/2026/03/12/audio_bea8e8877a.mp3",
      pageUrl: "https://pixabay.com/music/rock-energetic-action-sport-500409/",
      energy: "high",
      bestForSeconds: [12, 45],
    },
  ],
  travel: [
    {
      title: "Happy Together - Food Vlog Travel Music",
      artist: "SunnyVibesAudio",
      mp3Url: "https://cdn.pixabay.com/audio/2024/10/04/audio_77997f7fe5.mp3",
      pageUrl: "https://pixabay.com/music/happy-childrens-tunes-happy-together-food-vlog-travel-music-247319/",
      energy: "medium",
      bestForSeconds: [15, 70],
    },
    {
      title: "Orchestral",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/04/13/audio_339e92e1e4.mp3",
      pageUrl: "https://pixabay.com/music/adventure-orchestral-518713/",
      energy: "medium",
      bestForSeconds: [30, 80],
    },
    {
      title: "Epic - Cinematic Epic",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/02/10/audio_c28c6de8cc.mp3",
      pageUrl: "https://pixabay.com/music/adventure-epic-cinematic-epic-482367/",
      energy: "low",
      bestForSeconds: [35, 90],
    },
  ],
  adventure: [
    {
      title: "Orchestral",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/04/13/audio_339e92e1e4.mp3",
      pageUrl: "https://pixabay.com/music/adventure-orchestral-518713/",
      energy: "high",
      bestForSeconds: [20, 70],
    },
    {
      title: "Epic - Cinematic Epic",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/02/10/audio_c28c6de8cc.mp3",
      pageUrl: "https://pixabay.com/music/adventure-epic-cinematic-epic-482367/",
      energy: "medium",
      bestForSeconds: [35, 90],
    },
    {
      title: "Energetic Action Sport",
      artist: "AlexGrohl",
      mp3Url: "https://cdn.pixabay.com/audio/2026/03/12/audio_bea8e8877a.mp3",
      pageUrl: "https://pixabay.com/music/rock-energetic-action-sport-500409/",
      energy: "high",
      bestForSeconds: [10, 40],
    },
  ],
  sport: [
    {
      title: "Energetic Action Sport",
      artist: "AlexGrohl",
      mp3Url: "https://cdn.pixabay.com/audio/2026/03/12/audio_bea8e8877a.mp3",
      pageUrl: "https://pixabay.com/music/rock-energetic-action-sport-500409/",
      energy: "high",
      bestForSeconds: [10, 55],
    },
    {
      title: "Energetic Pop",
      artist: "JonasBlakewood",
      mp3Url: "https://cdn.pixabay.com/audio/2026/07/06/audio_861793bc24.mp3",
      pageUrl: "https://pixabay.com/music/dance-energetic-pop-562841/",
      energy: "high",
      bestForSeconds: [10, 35],
    },
    {
      title: "Orchestral",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/04/13/audio_339e92e1e4.mp3",
      pageUrl: "https://pixabay.com/music/adventure-orchestral-518713/",
      energy: "medium",
      bestForSeconds: [25, 80],
    },
  ],
  cinematic: [
    {
      title: "Epic - Cinematic Epic",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/02/10/audio_c28c6de8cc.mp3",
      pageUrl: "https://pixabay.com/music/adventure-epic-cinematic-epic-482367/",
      energy: "medium",
      bestForSeconds: [30, 90],
    },
    {
      title: "Orchestral",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/04/13/audio_339e92e1e4.mp3",
      pageUrl: "https://pixabay.com/music/adventure-orchestral-518713/",
      energy: "medium",
      bestForSeconds: [25, 70],
    },
    {
      title: "Luxury - Luxury Music",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/07/25/audio_a5ae1921aa.mp3",
      pageUrl: "https://pixabay.com/music/modern-classical-luxury-luxury-music-573998/",
      energy: "low",
      bestForSeconds: [35, 90],
    },
  ],
  luxury: [
    {
      title: "Luxury - Luxury Music",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/07/25/audio_a5ae1921aa.mp3",
      pageUrl: "https://pixabay.com/music/modern-classical-luxury-luxury-music-573998/",
      energy: "low",
      bestForSeconds: [25, 90],
    },
    {
      title: "Epic - Cinematic Epic",
      artist: "PaulYudin",
      mp3Url: "https://cdn.pixabay.com/audio/2026/02/10/audio_c28c6de8cc.mp3",
      pageUrl: "https://pixabay.com/music/adventure-epic-cinematic-epic-482367/",
      energy: "medium",
      bestForSeconds: [35, 90],
    },
    {
      title: "Happy Together - Food Vlog Travel Music",
      artist: "SunnyVibesAudio",
      mp3Url: "https://cdn.pixabay.com/audio/2024/10/04/audio_77997f7fe5.mp3",
      pageUrl: "https://pixabay.com/music/happy-childrens-tunes-happy-together-food-vlog-travel-music-247319/",
      energy: "medium",
      bestForSeconds: [15, 55],
    },
  ],
};
