import { useEffect, useMemo, useState } from "react";
import { Crop, Upload, X } from "lucide-react";

const CROP_SIZE = 280;
const MODAL_CHROME_HEIGHT = 420;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      if (typeof img.decode === "function") {
        try {
          await img.decode();
        } catch {
          // Some mobile browsers throw even after onload; keep going.
        }
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });
}

async function createCroppedFile({
  imageSrc,
  imageWidth,
  imageHeight,
  drawWidth,
  drawHeight,
  offsetX,
  offsetY,
  outputType = "image/jpeg",
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CROP_SIZE;
  canvas.height = CROP_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available in this browser.");
  }

  const img = await loadImage(imageSrc);

  const destX = (CROP_SIZE - drawWidth) / 2 + offsetX;
  const destY = (CROP_SIZE - drawHeight) / 2 + offsetY;

  const sourceX = (-destX / drawWidth) * imageWidth;
  const sourceY = (-destY / drawHeight) * imageHeight;
  const sourceWidth = (CROP_SIZE / drawWidth) * imageWidth;
  const sourceHeight = (CROP_SIZE / drawHeight) * imageHeight;

  context.drawImage(
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    CROP_SIZE,
    CROP_SIZE,
  );

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) reject(new Error("Failed to create cropped image."));
        else resolve(nextBlob);
      },
      outputType,
      0.92,
    );
  });

  return new File([blob], "avatar.jpg", { type: outputType });
}

export default function AvatarEditorModal({
  isOpen,
  file,
  title = "Edit profile picture",
  isSaving = false,
  onClose,
  onSave,
}) {
  const [imageSrc, setImageSrc] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isImageReady, setIsImageReady] = useState(false);
  const [imageError, setImageError] = useState("");
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 900,
  }));

  useEffect(() => {
    if (!isOpen || !file) return;
    let cancelled = false;

    setImageSrc("");
    setImageSize({ width: 0, height: 0 });
    setIsImageReady(false);
    setImageError("");
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);

    readFileAsDataUrl(file)
      .then(async (dataUrl) => {
        if (cancelled) return;

        setImageSrc(dataUrl);
        const image = await loadImage(dataUrl);
        if (cancelled) return;

        setImageSize({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        setIsImageReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setImageError(error.message || "Failed to load selected image.");
      });

    return () => {
      cancelled = true;
    };
  }, [file, isOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !isOpen) return undefined;

    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);

    return () => {
      window.removeEventListener("resize", updateViewportSize);
    };
  }, [isOpen]);

  const baseScale = useMemo(() => {
    if (!imageSize.width || !imageSize.height) return 1;
    return Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height);
  }, [imageSize.height, imageSize.width]);

  const drawWidth = imageSize.width * baseScale * zoom;
  const drawHeight = imageSize.height * baseScale * zoom;
  const maxOffsetX = Math.max(0, (drawWidth - CROP_SIZE) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - CROP_SIZE) / 2);
  const previewScale = useMemo(() => {
    const widthScale = (viewportSize.width - 80) / CROP_SIZE;
    const heightScale = (viewportSize.height - MODAL_CHROME_HEIGHT) / CROP_SIZE;
    return clamp(Math.min(1, widthScale, heightScale), 0.62, 1);
  }, [viewportSize.height, viewportSize.width]);
  const previewFrameSize = Math.round(CROP_SIZE * previewScale);

  useEffect(() => {
    setOffsetX((current) => clamp(current, -maxOffsetX, maxOffsetX));
    setOffsetY((current) => clamp(current, -maxOffsetY, maxOffsetY));
  }, [maxOffsetX, maxOffsetY]);

  if (!isOpen || !file) return null;

  const handleSave = async () => {
    try {
      const croppedFile = await createCroppedFile({
        imageSrc,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        drawWidth,
        drawHeight,
        offsetX,
        offsetY,
      });
      await onSave(croppedFile);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={isSaving ? undefined : onClose}
      />

      <div className="relative max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500">
              Adjust zoom and position before uploading.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-6">
          <div className="flex justify-center">
            <div className="rounded-[2rem] bg-gray-100 p-3 sm:p-4">
              <div
                className="relative overflow-hidden rounded-[2rem] bg-gray-200"
                style={{ width: previewFrameSize, height: previewFrameSize }}
              >
                {imageSrc && isImageReady ? (
                  <div
                    className="absolute left-0 top-0"
                    style={{
                      width: CROP_SIZE,
                      height: CROP_SIZE,
                      transform: `scale(${previewScale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <img
                      src={imageSrc}
                      alt="Avatar crop preview"
                      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                      style={{
                        width: drawWidth,
                        height: drawHeight,
                        transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-4 ring-white/80" />
                    <div className="pointer-events-none absolute inset-3 rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm font-medium text-gray-500">
                    {imageError || "Loading preview..."}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700">
                <Crop size={16} className="text-orange-500" />
                Crop controls
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">
                    Zoom
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">
                    Horizontal
                  </span>
                  <input
                    type="range"
                    min={-maxOffsetX}
                    max={maxOffsetX}
                    step="1"
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.target.value))}
                    className="w-full accent-orange-500"
                    disabled={maxOffsetX === 0}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500">
                    Vertical
                  </span>
                  <input
                    type="range"
                    min={-maxOffsetY}
                    max={maxOffsetY}
                    step="1"
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                    className="w-full accent-orange-500"
                    disabled={maxOffsetY === 0}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-700">
              The final profile photo will be cropped to a square image and
              displayed as a circle across the app.
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="w-full rounded-xl bg-gray-100 px-4 py-3 font-bold text-gray-700 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !isImageReady || !imageSize.width}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-bold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload size={16} />
                {isSaving ? "Saving..." : "Save photo"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
