"""
MusicGen Server for ClipsyReel (Real MusicGen AI Version)
Generates authentic background music using Hugging Face MusicGen model
"""

import os
import torch
from io import BytesIO
from typing import Optional
from fastapi import FastAPI, Form, HTTPException, Response
import uvicorn
import logging
import wave
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MusicGen Real")

# Global model cache
model = None
processor = None
device = None

# Music style descriptions mapped to video styles
STYLE_PROMPTS = {
    "viral": "upbeat modern pop for short-form video, clear melodic hook, punchy groove, uplifting chord progression, dynamic lift, memorable topline, polished and catchy",
    "sport": "cinematic action soundtrack with strong melodic theme, driving percussion, rising tension, bold brass and strings, powerful build, heroic energy",
    "luxury": "sophisticated elegant lounge music with warm piano, tasteful strings, smooth bass, refined melodic phrase, premium understated groove",
    "cinematic": "dramatic film score with emotional melodic arc, evolving harmony, expressive strings, subtle pulse, tension and release, sweeping lift",
    "adventure": "epic adventurous soundtrack with strong melodic motif, organic percussion, wide cinematic build, emotional progression, inspiring sense of movement",
    "motivational": "uplifting inspirational soundtrack with memorable melody, driving rhythm, progressive build, triumphant chords and confident energy",
    "chill": "melodic chilled lo-fi beat with soft groove, warm keys, gentle bassline, evolving harmony, relaxed but memorable musical phrase",
    "ambient": "cinematic ambient bed with delicate melody, evolving pads, soft pulse, emotional depth, airy texture, gradual movement"
}


def initialize_model():
    """Load MusicGen model from Hugging Face"""
    global model, processor, device
    
    if model is not None:
        return model, processor, device
    
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"🎵 Using device: {device}")
        
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
        
        logger.info("📥 Loading MusicGen model from Hugging Face (facebook/musicgen-small)...")
        processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
        model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small").to(device)
        
        logger.info("✅ MusicGen model loaded successfully!")
        return model, processor, device
    except Exception as e:
        logger.error(f"❌ Failed to load MusicGen model: {str(e)}")
        raise


@app.on_event("startup")
async def startup_event():
    """Warm up model on server startup"""
    try:
        initialize_model()
    except Exception as e:
        logger.warning(f"⚠️ Model initialization during startup failed: {e}")
        logger.info("Model will be loaded on first request")


@app.get("/health")
async def health():
    """Health check endpoint"""
    global model
    model_loaded = model is not None
    return {
        "ok": True,
        "provider": "musicgen",
        "model_loaded": model_loaded,
        "device": device if device else "unknown"
    }


def generate_music_from_description(description: str, duration: int = 10, intensity: float = 0.8):
    """
    Generate music using real MusicGen based on text description.
    
    Args:
        description: Text description of the music
        duration: Duration in seconds (max 30)
        intensity: Intensity scaling (0.0-1.0)
    
    Returns:
        Audio data as WAV bytes
    """
    global model, processor, device
    
    if model is None:
        initialize_model()
    
    try:
        logger.info(f"🎼 Generating music: '{description}' ({duration}s, intensity={intensity})...")
        
        # Add intensity to prompt
        intensity_desc = ""
        if intensity < 0.3:
            intensity_desc = "soft, quiet, subtle "
        elif intensity < 0.7:
            intensity_desc = "moderate, balanced "
        elif intensity < 0.9:
            intensity_desc = "energetic, prominent "
        else:
            intensity_desc = "intense, powerful, maximalist "
        
        full_description = (
            f"{intensity_desc}{description}. "
            "Create a musical piece with a clear beginning, a small build, and a memorable melodic motif. "
            "Avoid flat repetition, avoid shapeless ambient noise, and keep the soundtrack structured for visual editing."
        )
        
        # Process text input
        inputs = processor(text=[full_description], padding=True, return_tensors="pt").to(device)
        
        # Generate audio
        # MusicGen uses 50 tokens per second at 32kHz
        # Limit to 30 seconds max
        max_duration = min(duration, 30)
        
        with torch.no_grad():
            audio_values = model.generate(
                **inputs,
                max_length=int(max_duration * 50),  # 50 tokens/second
                temperature=0.72 + (intensity * 0.08),
                do_sample=True,
            )
        
        # Convert to numpy (32kHz mono)
        audio_data = audio_values.cpu().numpy()[0]

        if audio_data.ndim > 1:
            audio_data = np.mean(audio_data, axis=0)

        # Normalize audio and ensure a valid mono waveform
        max_val = np.abs(audio_data).max()
        if max_val > 0:
            audio_data = audio_data / max_val * 0.95  # Slight headroom

        audio_data = np.clip(audio_data, -1.0, 1.0)
        int16_buffer = np.int16(audio_data * 32767.0)

        logger.info(f"✅ Music generated: {int16_buffer.shape[0]} samples at 32kHz")

        wav_buffer = BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(32000)
            wav_file.writeframes(int16_buffer.tobytes())

        wav_buffer.seek(0)
        return wav_buffer.getvalue()
        
    except Exception as e:
        logger.error(f"❌ Error generating music: {str(e)}")
        raise


@app.post("/generate-music")
async def generate_music(
    style: str = Form("viral"),
    duration: float = Form(30.0),
    bpm: Optional[int] = Form(None),
    intensity: Optional[float] = Form(0.8)
):
    """
    Generate real background music using MusicGen AI
    """
    
    try:
        # Validate inputs
        if duration < 5 or duration > 60:
            raise ValueError("Duration must be between 5 and 60 seconds")
        
        if intensity is None:
            intensity = 0.8
        elif intensity < 0.0 or intensity > 1.0:
            raise ValueError("Intensity must be between 0.0 and 1.0")
        
        if style not in STYLE_PROMPTS:
            raise ValueError(f"Unknown style: {style}. Available: {', '.join(STYLE_PROMPTS.keys())}")
        
        # Get description
        description = STYLE_PROMPTS[style]
        
        # Add BPM hint if provided
        if bpm:
            if bpm < 80:
                description = f"slow relaxing tempo ({bpm} BPM), {description}"
            elif bpm < 120:
                description = f"moderate steady rhythm ({bpm} BPM), {description}"
            else:
                description = f"fast energetic tempo ({bpm} BPM), {description}"
        
        logger.info(f"🎵 Music Request: style={style}, duration={duration}s, bpm={bpm}, intensity={intensity}")
        
        # Generate audio
        wav_data = generate_music_from_description(
            description=description,
            duration=int(duration),
            intensity=intensity
        )
        
        return Response(
            content=wav_data,
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=background-music.wav"}
        )
    
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Music generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Music generation failed: {str(e)}")


if __name__ == "__main__":
    port = int(os.getenv("MUSICGEN_PORT", 8788))
    logger.info(f"🚀 Starting MusicGen server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
