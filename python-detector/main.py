"""
YOLOv8 Object Detection Server for ClipsyReel
Detects motorcycles and cars in video frames
"""

import os
import json
from io import BytesIO
from typing import Optional
from PIL import Image
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO

app = FastAPI(title="YOLOv8 Detector")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLOv8 model once at startup
print("Loading YOLOv8 model...")
try:
    import torch

    # PyTorch 2.6+ defaults to weights_only=True, which breaks the YOLOv8 checkpoint format.
    # Force legacy full deserialization for the local trusted model so the detector works reliably.
    original_torch_load = torch.load

    def compat_torch_load(*args, **kwargs):
        kwargs.setdefault("weights_only", False)
        return original_torch_load(*args, **kwargs)

    torch.load = compat_torch_load
    model = YOLO("yolov8n.pt")  # nano model is lighter and good enough for local detection
    print("✓ YOLOv8 model loaded")
except Exception as e:
    print(f"✗ Failed to load model: {e}")
    model = None


class DetectionResponse:
    """Standardized detection response format"""
    
    def __init__(self, provider: str = "yolov8"):
        self.provider = provider
        self.frames = []
    
    def add_frame(self, time: float, detections: list):
        self.frames.append({
            "time": time,
            "detections": detections
        })
    
    def to_dict(self):
        return {
            "provider": self.provider,
            "frames": self.frames
        }


def parse_target_labels(labels_json: Optional[str]) -> list[str]:
    """Parse target labels from JSON string"""
    if not labels_json:
        return ["motorcycle", "car"]
    
    try:
        labels = json.loads(labels_json)
        if not isinstance(labels, list):
            return ["motorcycle", "car"]
        # Filter to only motorcycle and car
        return [l for l in labels if l in ["motorcycle", "car"]] or ["motorcycle", "car"]
    except:
        return ["motorcycle", "car"]


def detect_objects_in_image(image_buffer: bytes, target_labels: list[str]) -> list:
    """
    Run YOLOv8 detection on an image buffer
    Returns detections in ClipsyReel format
    """
    if not model:
        raise RuntimeError("YOLOv8 model not loaded")
    
    # Convert bytes to PIL Image
    image = Image.open(BytesIO(image_buffer))
    image_array = np.array(image)
    
    # Run inference
    results = model(image_array, verbose=False)
    
    detections = []
    
    if results and len(results) > 0:
        result = results[0]
        
        # Map YOLO class IDs to readable labels
        # COCO dataset: 0=person, 1=bicycle, 2=car, 3=motorbike, ...
        class_map = {
            2: "car",        # COCO class 2
            3: "motorcycle"  # COCO class 3
        }
        
        if result.boxes:
            for box in result.boxes:
                class_id = int(box.cls[0])
                label = class_map.get(class_id)
                
                # Only include target labels
                if label not in target_labels:
                    continue
                
                confidence = float(box.conf[0])
                
                # Normalize bounding box coordinates (0-1)
                x1, y1, x2, y2 = box.xyxy[0]
                image_height, image_width = image_array.shape[:2]
                
                x = float(x1) / image_width
                y = float(y1) / image_height
                width = float(x2 - x1) / image_width
                height = float(y2 - y1) / image_height
                
                detection = {
                    "label": label,
                    "confidence": round(confidence, 2),
                    "bbox": {
                        "x": round(x, 3),
                        "y": round(y, 3),
                        "width": round(width, 3),
                        "height": round(height, 3)
                    }
                }
                detections.append(detection)
    
    return detections


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "ok": True,
        "provider": "yolov8",
        "model_loaded": model is not None
    }


@app.post("/detect-objects")
async def detect_objects(
    video: UploadFile = File(...),
    sampleTimes: str = Form(...),
    targetLabels: Optional[str] = Form(None)
):
    """
    Detect objects in sampled video frames
    
    Expects:
    - video: MP4 file
    - sampleTimes: JSON array of seconds [1.0, 2.5, 3.8, ...]
    - targetLabels: JSON array (optional, defaults to ["motorcycle", "car"])
    
    Returns:
    {
        "provider": "yolov8",
        "frames": [
            {
                "time": 1.0,
                "detections": [
                    {
                        "label": "motorcycle",
                        "confidence": 0.86,
                        "bbox": {"x": 0.34, "y": 0.29, "width": 0.24, "height": 0.19}
                    }
                ]
            }
        ]
    }
    """
    
    if not model:
        raise HTTPException(status_code=500, detail="YOLOv8 model not loaded")
    
    try:
        # Parse inputs
        sample_times = json.loads(sampleTimes)
        if not isinstance(sample_times, list) or len(sample_times) == 0:
            raise ValueError("sampleTimes must be a non-empty array")
        
        target_labels = parse_target_labels(targetLabels)
        
        # Read video file
        video_buffer = await video.read()
        
        # Save to temporary file (OpenCV needs file path for video)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_buffer)
            video_path = tmp.name
        
        try:
            # Open video
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                raise ValueError("Failed to open video file")
            
            response = DetectionResponse()
            
            # Process each sample time
            for sample_time in sample_times:
                # Seek to frame
                frame_number = int(sample_time * cap.get(cv2.CAP_PROP_FPS))
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
                
                ret, frame = cap.read()
                if not ret:
                    continue
                
                # Convert frame to JPEG buffer
                _, buffer = cv2.imencode(".jpg", frame)
                frame_buffer = buffer.tobytes()
                
                # Run detection
                detections = detect_objects_in_image(frame_buffer, target_labels)
                response.add_frame(sample_time, detections)
            
            cap.release()
            return JSONResponse(response.to_dict())
        
        finally:
            # Clean up temp file
            if os.path.exists(video_path):
                os.remove(video_path)
    
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON in sampleTimes: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DETECTION_PORT", 8787))
    print(f"Starting YOLOv8 detector on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
