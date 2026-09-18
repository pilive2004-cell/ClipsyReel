# YOLOv8 Object Detection Server

Python-based detection server for ClipsyReel using YOLOv8.

## Setup

### Prerequisites

- Python 3.9+
- pip

### Installation

```bash
# From the python-detector directory
cd python-detector
pip install -r requirements.txt
```

This installs:
- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **ultralytics**: YOLOv8 (will auto-download `yolov8m.pt` on first run)
- **opencv-python**: Video frame extraction
- **Pillow**: Image processing

### Running the Server

```bash
python main.py
```

Or specify a custom port:

```bash
DETECTION_PORT=8787 python main.py
```

The server will:
1. Load the YOLOv8 model (~50MB download, first time only)
2. Listen on `http://localhost:8787`
3. Be ready to accept video files for detection

### Configuring ClipsyReel to Use It

In your `.env.local`:

```env
NEXT_PUBLIC_OBJECT_DETECTION_API_URL=http://localhost:8787/detect-objects
OBJECT_DETECTION_PROVIDER=http
OBJECT_DETECTION_REMOTE_URL=http://localhost:8787/detect-objects
```

Or use the Settings UI in ClipsyReel to set `OBJECT_DETECTION_REMOTE_URL=http://localhost:8787/detect-objects`.

### API Endpoints

#### Health Check

```bash
GET /health
```

Response:
```json
{
  "ok": true,
  "provider": "yolov8",
  "model_loaded": true
}
```

#### Object Detection

```bash
POST /detect-objects
Content-Type: multipart/form-data

Form fields:
- video: <mp4 file>
- sampleTimes: "[1.0, 2.5, 3.8]" (JSON array of seconds)
- targetLabels: "[\"motorcycle\", \"car\"]" (optional, JSON array)
```

Response:
```json
{
  "provider": "yolov8",
  "frames": [
    {
      "time": 1.0,
      "detections": [
        {
          "label": "motorcycle",
          "confidence": 0.86,
          "bbox": {
            "x": 0.34,
            "y": 0.29,
            "width": 0.24,
            "height": 0.19
          }
        }
      ]
    }
  ]
}
```

### Model Details

- **Model**: YOLOv8 Medium (`yolov8m.pt`)
- **Input**: Video frames (extracted from MP4)
- **Output**: Detections for classes: `motorcycle`, `car`
- **Speed**: ~20-50ms per frame (depends on GPU/CPU)
- **Accuracy**: COCO-trained, high accuracy on vehicles

### Troubleshooting

**"ModuleNotFoundError: No module named 'ultralytics'"**
```bash
pip install ultralytics
```

**"Failed to download model"**
- Check internet connection (YOLOv8 downloads model on first run)
- Manual download: `python -c "from ultralytics import YOLO; YOLO('yolov8m.pt')"`

**Server crashes on video processing**
- Ensure FFmpeg/OpenCV are properly installed
- Check video format is H.264 MP4
- Increase system memory if processing large videos

**Slow detection**
- YOLOv8m is moderate-speed
- For faster: Use `yolov8n.pt` (nano) - less accurate but 2x faster
- For more accurate: Use `yolov8l.pt` (large) - more accurate but slower
- Edit `main.py` line 16 to switch models

### Next Steps

1. ✅ Install dependencies: `pip install -r requirements.txt`
2. ✅ Start server: `python main.py`
3. ✅ Configure ClipsyReel to use `http://localhost:8787/detect-objects`
4. ✅ Upload a video in ClipsyReel and test detection

