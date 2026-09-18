# MusicGen Server for ClipsyReel

Generates adaptive background music based on video style and pacing.

## Setup

### Prerequisites
- Python 3.9+
- CUDA-capable GPU (recommended) or CPU

### Installation

```bash
cd python-musicgen
pip install -r requirements.txt
```

This installs:
- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **audiocraft**: Meta's MusicGen (will auto-download model ~3GB on first run)
- **torch/torchaudio**: Deep learning & audio processing

### Running the Server

```bash
python main.py
```

Or specify a custom port:

```bash
MUSICGEN_PORT=8788 python main.py
```

First run will download the MusicGen model (~3GB). Subsequent runs are instant.

## API Endpoints

### Health Check

```bash
GET /health
```

### Generate Music

```bash
POST /generate-music
Content-Type: application/x-www-form-urlencoded

Parameters:
- style: "viral", "sport", "luxury", "cinematic", "adventure", "motivational"
- duration: 5-60 seconds
- bpm: optional beats per minute
- intensity: 0.0-1.0 (0.0=ambient, 1.0=energetic)
```

Response: `audio/wav` file (44.1kHz stereo, safe for MP4 muxing)

## Integration with ClipsyReel

The music is generated **after analysis** and **before render**:

1. **Video Upload** → Analyze style & BPM
2. **Auto-Generate Music** → Call MusicGen with detected style
3. **Render** → Build montage without audio
4. **Export Options** → User chooses:
   - Export with generated music (FFmpeg mux)
   - Export without music (for Instagram library music)

## Performance Notes

- **First generation**: ~30-60 seconds (model inference)
- **Subsequent generations**: ~15-30 seconds (same style)
- **GPU**: 5-10x faster with CUDA/MPS
- **CPU fallback**: Works but slower (~60-120s per generation)

## Troubleshooting

**"Failed to load model"**
```bash
# Download manually
python -c "from audiocraft.models import MusicGen; MusicGen.get_model('medium')"
```

**CUDA out of memory**
- Use `small` model instead of `medium` (edit main.py line 40)
- Or run on CPU (slower but works)

**Audio sync issues**
- All audio output is 44.1kHz stereo WAV
- FFmpeg will auto-convert during muxing
