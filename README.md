This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## ClipsyReel local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Optional object detection backend

ClipsyReel can optionally boost best-moment scoring toward **motorcycles** and **cars**.

1. Copy `.env.example` to `.env.local`
2. Set:
   - `NEXT_PUBLIC_OBJECT_DETECTION_API_URL=http://localhost:8787/detect-objects`
   - `OBJECT_DETECTION_PROVIDER=mock` for local testing, or `http` to proxy a real YOLO/COCO-style detector
3. Start the backend:

```bash
npm run detect:server
```

### Backend contract

- `POST /detect-objects`
- multipart form fields:
  - `video`: uploaded source video
  - `sampleTimes`: JSON array of seconds
  - `targetLabels`: JSON array, typically `["motorcycle","car"]`

Response:

```json
{
  "provider": "mock",
  "frames": [
    {
      "time": 1.25,
      "detections": [
        {
          "label": "motorcycle",
          "confidence": 0.86,
          "bbox": { "x": 0.34, "y": 0.29, "width": 0.24, "height": 0.19 }
        }
      ]
    }
  ]
}
```

When `OBJECT_DETECTION_PROVIDER=http`, the backend extracts sampled JPG frames with local `ffmpeg` and forwards each frame to `OBJECT_DETECTION_REMOTE_URL`, expecting either:

- a raw detection array, or
- `{ "detections": [...] }`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
