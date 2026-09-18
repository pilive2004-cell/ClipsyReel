# ClipsyReel with MusicGen Integration

## Architecture Overview

This setup enables **automatic music generation** that adapts to your video's style and rhythm:

```
Video Upload
    ↓
Analyze Style & BPM
    ↓
[Parallel] Render Video + Generate Music
    ↓
Export Dialog: Choose with/without music
    ↓
FFmpeg muxes Video + Audio (or exports video only)
```

## Services

### 1. YOLOv8 Object Detection (Port 8787)
- Detects motorcycles and cars in video frames
- Enhances "best moment" scoring

```bash
python /Users/Q360541/Documents/reelcraft-ai/python-detector/main.py
```

### 2. MusicGen (Port 8788)
- Generates adaptive background music based on style
- Supports: viral, sport, luxury, cinematic, adventure, motivational

```bash
python /Users/Q360541/Documents/reelcraft-ai/python-musicgen/main.py
```

### 3. ClipsyReel Frontend/Backend (Port 3000)
- React UI for video creation
- Node.js/Next.js backend

```bash
npm run dev
```

## Setup Instructions

### Install Python Dependencies

```bash
# YOLOv8
cd python-detector && pip install -r requirements.txt && cd ..

# MusicGen (requires ~3GB model download on first run)
cd python-musicgen && pip install -r requirements.txt && cd ..
```

### Start All Services

**Option 1: Sequential**
```bash
# Terminal 1: YOLOv8
cd python-detector && python main.py

# Terminal 2: MusicGen
cd python-musicgen && python main.py

# Terminal 3: ClipsyReel
npm run dev
```

**Option 2: Parallel (from project root)**
```bash
# In background
python python-detector/main.py &
python python-musicgen/main.py &
npm run dev
```

### Configuration

`.env.local`:
```env
# Object Detection (YOLOv8)
NEXT_PUBLIC_OBJECT_DETECTION_API_URL=http://localhost:8787/detect-objects
OBJECT_DETECTION_PROVIDER=http
OBJECT_DETECTION_REMOTE_URL=http://localhost:8787/detect-objects

# Music Generation (MusicGen)
MUSICGEN_API_URL=http://localhost:8788/generate-music

# Other
FFMPEG_BINARY=ffmpeg
```

## How It Works

### 1. Video Analysis
When you upload a video, ClipsyReel:
- Detects the style (viral, sport, luxury, etc.)
- Estimates BPM from video motion/pacing
- Stores metadata for music generation

### 2. Music Generation
During render, a hook generates music in parallel:
```typescript
const { audioBlob, isLoading } = useMusicGen();

await generateMusic({
  style: "viral",      // Detected from video
  duration: 30,        // Video duration
  bpm: 120,           // Detected or manual
  intensity: 0.8      // How energetic
});
```

### 3. Export Options
When exporting, user chooses:
- ✅ **With Music**: FFmpeg muxes video + audio (audio/aac)
- ❌ **Without Music**: Export video only (for Instagram library music)

## API Endpoints

### Generate Music
```
POST /api/generate-music
Content-Type: application/json

{
  "style": "viral",
  "duration": 30,
  "bpm": 120,
  "intensity": 0.8
}

Response: audio/wav file
```

### Mux Audio
```
POST /api/mux-audio
Content-Type: multipart/form-data

Fields:
- video: MP4 file
- audio: WAV file

Response: MP4 file with audio track
```

## Performance Notes

- **First MusicGen startup**: ~5-10 min (model download + init)
- **Music generation**: 15-30s per track
- **Video rendering**: Happens in parallel with music
- **Export with audio**: ~5-10s (FFmpeg mux only, no re-encoding)

## Troubleshooting

### MusicGen server won't start
```bash
# Check if port 8788 is in use
lsof -i :8788

# Try custom port
MUSICGEN_PORT=8789 python python-musicgen/main.py
```

### Music generation fails
- Check `MUSICGEN_API_URL` in `.env.local`
- Verify MusicGen server is running
- Check logs: look for "MusicGen error" in browser console

### FFmpeg muxing fails
- Ensure FFmpeg is installed: `which ffmpeg`
- Check video is valid MP4 format
- Audio must be WAV 44.1kHz (MusicGen outputs this)

### Out of Memory
- YOLOv8: Use `yolov8n.pt` (nano) instead of `yolov8m.pt`
- MusicGen: Use `small` model instead of `medium`

## Next Steps

1. ✅ Generate music automatically during render
2. ✅ Offer with/without music export options
3. 💡 **Future**: Music style customization panel
4. 💡 **Future**: Adjust music intensity based on video energy
5. 💡 **Future**: Multiple music variations to choose from

## Architecture Decisions

### Why separate Python services?
- YOLOv8 and MusicGen need PyTorch (heavyweight in Node.js)
- Python is faster for deep learning
- HTTP bridges allow any language rewrite later

### Why MusicGen over alternatives?
- Free and open-source (Meta)
- Good quality for short clips
- Fast inference (15-30s)
- Easy to customize via prompts

### Why FFmpeg for muxing?
- Industry standard, reliable
- Fast (copy codec, no re-encoding)
- Widely available
- Handles all container formats

