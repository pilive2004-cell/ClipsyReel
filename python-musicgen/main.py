"""
MusicGen Server for ClipsyReel (Simplified Mock Version)
Generates background music or mock audio for testing
"""

import os
import json
from io import BytesIO
from typing import Optional
import numpy as np
from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import StreamingResponse
import wave
import struct

app = FastAPI(title="MusicGen")

# Music style descriptions mapped to video styles
STYLE_PROMPTS = {
    "viral": "upbeat energetic trap music with heavy bass and dynamic drums",
    "sport": "high-energy cinematic music with powerful orchestral elements",
    "luxury": "sophisticated classical-inspired ambient music with elegant strings",
    "cinematic": "dramatic orchestral music with building tension",
    "adventure": "epic adventurous music with world instruments",
    "motivational": "powerful inspirational music with uplifting melodies"
}

# Load model once at startup
print("Initializing MusicGen mock server...")
print("✓ MusicGen mock initialized (ready for testing)")
model = True  # Just a marker that "model is ready"


def generate_mock_audio(duration: float, style: str, bpm: Optional[int] = None) -> bytes:
    """
    Generate mock WAV audio (48kHz stereo, duration in seconds)
    In production, this would call real MusicGen.
    For testing, this generates silence with slight tone variation.
    """
    sample_rate = 48000
    channels = 2
    num_samples = int(duration * sample_rate)
    
    # Generate simple sine wave pattern based on style
    frequency_map = {
        "viral": 440,      # A4 - upbeat
        "sport": 220,      # A3 - deep bass
        "luxury": 330,     # E4 - smooth
        "cinematic": 165,  # E3 - dramatic
        "adventure": 392,  # G4 - adventurous
        "motivational": 494  # B4 - uplifting
    }
    
    frequency = frequency_map.get(style, 440)
    t = np.arange(num_samples) / sample_rate
    
    # Generate tone with gentle fade in/out
    tone = np.sin(2 * np.pi * frequency * t) * 0.3
    fade_in = np.minimum(t * 2, 1.0)  # 0.5s fade-in
    fade_out = np.minimum((duration - t) * 2, 1.0)  # 0.5s fade-out
    tone = tone * fade_in * fade_out
    
    # Duplicate for stereo
    audio_data = np.column_stack([tone, tone])
    
    # Convert to 16-bit PCM
    audio_data = (audio_data * 32767).astype(np.int16)
    
    # Write WAV
    wav_buffer = BytesIO()
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())
    
    wav_buffer.seek(0)
    return wav_buffer.getvalue()


def get_music_prompt(style: str, duration_seconds: float, bpm: Optional[int] = None) -> str:
    """
    Generate a music prompt based on video style and BPM
    """
    base_prompt = STYLE_PROMPTS.get(style, STYLE_PROMPTS["viral"])
    
    # Adjust BPM description
    bpm_str = ""
    if bpm:
        if bpm < 80:
            bpm_str = "slow relaxing tempo, "
        elif bpm < 120:
            bpm_str = "moderate steady rhythm, "
        else:
            bpm_str = "fast energetic tempo, "
    
    full_prompt = f"{bpm_str}{base_prompt}. Duration: approximately {int(duration_seconds)} seconds."
    return full_prompt


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "ok": True,
        "provider": "musicgen",
        "model_loaded": model is not None
    }


@app.post("/generate-music")
async def generate_music(
    style: str = Form("viral"),
    duration: float = Form(30.0),
    bpm: Optional[int] = Form(None),
    intensity: Optional[float] = Form(0.8)
):
    """
    Generate background music for a video
    Mock version for testing (no audiocraft dependency)
    """
    
    if not model:
        raise HTTPException(status_code=500, detail="MusicGen model not initialized")
    
    try:
        # Validate inputs
        if duration < 5 or duration > 60:
            raise ValueError("Duration must be between 5 and 60 seconds")
        
        if intensity < 0.0 or intensity > 1.0:
            raise ValueError("Intensity must be between 0.0 and 1.0")
        
        if style not in STYLE_PROMPTS:
            raise ValueError(f"Unknown style: {style}. Available: {', '.join(STYLE_PROMPTS.keys())}")
        
        print(f"Generating mock music: {style}, {duration}s, BPM={bpm}, intensity={intensity}")
        
        # Generate mock audio
        wav_data = generate_mock_audio(duration, style, bpm)
        
        return StreamingResponse(
            iter([wav_data]),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=background-music.wav"}
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Music generation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("MUSICGEN_PORT", 8788))
    print(f"Starting MusicGen server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
