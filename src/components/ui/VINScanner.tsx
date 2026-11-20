import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  AlertCircle,
  Loader2,
  Camera,
  X,
  ScanText,
  ImagePlus,
  SwitchCamera,
  Flashlight,
} from 'lucide-react';
import { trackEvent } from '../../services/telemetry';
import {
  hasValidVinCheckDigit,
  normalizeVinOcrText,
  recognizeVinFromImage,
  sanitizeVinInput,
  type VinCandidate,
} from '../../services/vinOcr';
import {
  createVinOcrCanvas,
  createVinOcrCanvasFromFile,
  frameSignatureDelta,
  measureVinFrameQuality,
  type VinFrameQuality,
} from '../../services/vinFrame';
import VINOcrReview from './VINOcrReview';
import styles from './VINScanner.module.css';

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

type BarcodeSupport = 'checking' | 'supported' | 'unsupported';
type CameraFacing = 'environment' | 'user';

interface VINScannerProps {
  onDecode: (vin: string) => void;
  loading: boolean;
  error: string | null;
  initialVin?: string;
}

interface OcrResult {
  candidates: VinCandidate[];
  selected: string;
}

type QualityHint = Pick<VinFrameQuality, 'level' | 'message'>;

// Sample VINs for the placeholder hint
const SAMPLE_VINS = [
  '4T1BF3EK8AU561547', // Toyota
  '1FTFW1ET5DFC43861', // Ford
  '2HGFC2F59JH531528', // Honda
  'WBAVB13516PT18676', // BMW
  '1VWFE21C04M000001', // VW
];

const CAMERA_PERMISSION_ERROR =
  'Camera permission is blocked. Allow camera access in your browser settings, then try again, or enter the VIN manually.';

const CAMERA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: CAMERA_PERMISSION_ERROR,
  SecurityError: CAMERA_PERMISSION_ERROR,
  NotFoundError: 'No camera was found. Connect a camera or enter the VIN manually.',
  NotReadableError:
    'The camera is in use or could not start. Close other apps using it, then try again, or enter the VIN manually.',
  OverconstrainedError:
    'That camera is not available. Try the other camera or enter the VIN manually.',
};
const CAMERA_ERROR_FALLBACK =
  'The camera could not be opened. Try again or enter the VIN manually.';
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const PHOTO_TOO_LARGE_ERROR =
  'That photo is too large. Choose an image under 12 MB, or enter the VIN manually.';
const SUPPORTED_PHOTO_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const PHOTO_TYPE_ERROR =
  "That file type isn't supported. Use a JPEG, PNG, WebP, GIF, AVIF, or BMP image, or enter the VIN manually.";

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  return CAMERA_ERROR_MESSAGES[name] ?? CAMERA_ERROR_FALLBACK;
}

function getBarcodeDetector(): BarcodeDetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach(track => track.stop());
}

function streamHasTorch(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  const capabilities = (track?.getCapabilities?.() ?? null) as
    | (MediaTrackCapabilities & { torch?: boolean })
    | null;
  return Boolean(capabilities?.torch);
}

function detectBarcodeSupport(): BarcodeSupport {
  const Detector = getBarcodeDetector();
  if (!Detector) return 'unsupported';
  return Detector.getSupportedFormats ? 'checking' : 'supported';
}

function requestCameraStream(facing: CameraFacing): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing } },
    audio: false,
  });
}

export default function VINScanner({ onDecode, loading, error, initialVin = '' }: VINScannerProps) {
  const [vin, setVin] = useState(initialVin);
  const [scanning, setScanning] = useState(false);
  const [scanIndex, setScanIndex] = useState(-1);
  const [hintIndex, setHintIndex] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraInlineError, setCameraInlineError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [barcodeSupport, setBarcodeSupport] = useState<BarcodeSupport>('checking');
  const [barcodeStatus, setBarcodeStatus] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityHint | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const scanButtonRef = useRef<HTMLButtonElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraClosingRef = useRef(false);
  const ocrAbortRef = useRef<AbortController | null>(null);
  const lastSignatureRef = useRef<Uint8ClampedArray | null>(null);
  const stableFramesRef = useRef(0);
  const autoAttemptedRef = useRef(false);

  // Rotate hint VINs
  useEffect(() => {
    const t = setInterval(() => {
      setHintIndex(i => (i + 1) % SAMPLE_VINS.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Keep the latest decode callback without restarting the scan timer
  const onDecodeRef = useRef(onDecode);
  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  // Scan animation on submit
  useEffect(() => {
    if (!scanning || vin.length !== 17) return;

    let index = -1;
    const interval = setInterval(() => {
      index += 1;
      if (index >= 17) {
        clearInterval(interval);
        setScanIndex(-1);
        setScanning(false);
        onDecodeRef.current(vin.toUpperCase());
      } else {
        setScanIndex(index);
      }
    }, 55);

    return () => clearInterval(interval);
  }, [scanning, vin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = vin.trim().toUpperCase();
    if (clean.length === 17) {
      setScanIndex(0);
      setScanning(true);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVin(sanitizeVinInput(e.target.value));
  };

  const useSample = () => {
    setVin(SAMPLE_VINS[hintIndex]);
    inputRef.current?.focus();
  };

  const closeCamera = useCallback(() => {
    cameraClosingRef.current = true;
    ocrAbortRef.current?.abort();
    ocrAbortRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    stopStream(stream);
    setCameraStream(null);
    setScanOpen(false);
    setCameraBusy(false);
    setCameraSwitching(false);
    setOcrBusy(false);
    setOcrStatus(null);
    setOcrProgress(0);
    setCameraInlineError(null);
    setBarcodeStatus(null);
    setQuality(null);
    setTorchAvailable(false);
    setTorchOn(false);
  }, []);

  const cancelCamera = useCallback(() => {
    setOcrError(null);
    closeCamera();
    window.setTimeout(() => scanButtonRef.current?.focus(), 0);
  }, [closeCamera]);

  const adoptStream = useCallback((stream: MediaStream, facing: CameraFacing) => {
    const previous = streamRef.current;
    streamRef.current = stream;
    cameraClosingRef.current = false;
    setCameraStream(stream);
    setCameraFacing(facing);
    setTorchAvailable(streamHasTorch(stream));
    setTorchOn(false);
    // Stop the old track only after the new stream is current, so its `ended`
    // event cannot be mistaken for the new preview failing.
    stopStream(previous);
  }, []);

  const handleCameraLost = useCallback(
    (source: MediaStream | null, reason: 'ended' | 'permission') => {
      if (!scanOpen || cameraClosingRef.current) return;
      if (source ? streamRef.current !== source : !streamRef.current) return;

      ocrAbortRef.current?.abort();
      ocrAbortRef.current = null;
      const stream = streamRef.current;
      streamRef.current = null;
      stopStream(stream);
      if (videoRef.current) videoRef.current.srcObject = null;

      setCameraStream(null);
      setCameraBusy(false);
      setCameraSwitching(false);
      setOcrBusy(false);
      setOcrStatus(null);
      setOcrProgress(0);
      setOcrError(null);
      setQuality(null);
      setTorchAvailable(false);
      setTorchOn(false);
      setBarcodeStatus(null);
      setCameraError(null);
      setCameraInlineError(
        reason === 'permission'
          ? 'Camera access was revoked. Allow camera access in your browser settings, then reconnect or use a photo.'
          : 'The camera stopped. Reconnect the camera, check that it is not in use by another app, or use a photo.',
      );
      trackEvent('vin_camera_lost', { reason });
    },
    [scanOpen],
  );

  const startCamera = useCallback(async () => {
    cameraClosingRef.current = false;
    setCameraError(null);
    setOcrError(null);
    setCameraInlineError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available. Enter the VIN manually or upload a photo.');
      return;
    }

    setCameraBusy(true);
    try {
      const stream = await requestCameraStream('environment');
      adoptStream(stream, 'environment');
      setBarcodeSupport(detectBarcodeSupport());
      setScanOpen(true);
      trackEvent('vin_camera_opened');
    } catch (error) {
      setCameraError(cameraErrorMessage(error));
    } finally {
      setCameraBusy(false);
    }
  }, [adoptStream]);

  const retryCamera = useCallback(async () => {
    if (cameraBusy) return;
    cameraClosingRef.current = false;
    setCameraBusy(true);
    setCameraInlineError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraInlineError('Camera access is not available. Use a photo or enter the VIN manually.');
        return;
      }
      const stream = await requestCameraStream(cameraFacing);
      adoptStream(stream, cameraFacing);
      setBarcodeSupport(detectBarcodeSupport());
      trackEvent('vin_camera_reconnected', { facing: cameraFacing });
    } catch (error) {
      setCameraInlineError(cameraErrorMessage(error));
    } finally {
      setCameraBusy(false);
    }
  }, [adoptStream, cameraBusy, cameraFacing]);

  const switchCamera = useCallback(async () => {
    if (cameraSwitching) return;
    const next: CameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraSwitching(true);
    setCameraInlineError(null);
    try {
      const stream = await requestCameraStream(next);
      adoptStream(stream, next);
      trackEvent('vin_camera_switched', { facing: next });
    } catch {
      setCameraInlineError(
        'That camera could not be started. Keep using the current view, switch back, or enter the VIN manually.',
      );
    } finally {
      setCameraSwitching(false);
    }
  }, [cameraFacing, cameraSwitching, adoptStream]);

  // A camera can disappear while the dialog is open: the device is unplugged,
  // another app takes it, or the user revokes permission. Stop the preview and
  // leave a recovery path instead of showing a frozen frame.
  useEffect(() => {
    if (!scanOpen || !cameraStream) return;
    const stream = cameraStream;
    const handleEnded = () => handleCameraLost(stream, 'ended');
    const tracks = stream.getVideoTracks();
    tracks.forEach(track => track.addEventListener('ended', handleEnded));
    stream.addEventListener('inactive', handleEnded);
    return () => {
      tracks.forEach(track => track.removeEventListener('ended', handleEnded));
      stream.removeEventListener('inactive', handleEnded);
    };
  }, [scanOpen, cameraStream, handleCameraLost]);

  useEffect(() => {
    if (!scanOpen) return;
    const permissions = navigator.permissions;
    if (!permissions?.query) return;

    let disposed = false;
    let status: PermissionStatus | null = null;
    const handlePermissionChange = () => {
      if (!disposed && status?.state === 'denied') {
        handleCameraLost(null, 'permission');
      }
    };

    void permissions
      .query({ name: 'camera' as PermissionName })
      .then(result => {
        if (disposed) return;
        status = result;
        if (result.state === 'denied') handleCameraLost(null, 'permission');
        result.addEventListener('change', handlePermissionChange);
      })
      .catch(() => {
        // Permission querying is not available in every browser; the track
        // ended/inactive listeners still cover camera loss there.
      });

    return () => {
      disposed = true;
      status?.removeEventListener('change', handlePermissionChange);
    };
  }, [scanOpen, handleCameraLost]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
      trackEvent('vin_camera_torch', { on: next });
    } catch {
      setTorchAvailable(false);
      setCameraInlineError('The torch is not available on this camera.');
    }
  }, [torchOn]);

  // Keep keyboard focus inside the camera dialog and let Escape cancel it.
  useEffect(() => {
    if (!scanOpen) return;
    const modal = modalRef.current;
    if (!modal) return;
    // Dismiss the mobile keyboard before focusing the dialog; otherwise it can
    // cover the action buttons at the bottom of the camera sheet.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    modal.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelCamera();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [scanOpen, cancelCamera]);

  // Attach the stream after the modal has mounted.
  useEffect(() => {
    if (!scanOpen || !cameraStream) return;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => {});
  }, [scanOpen, cameraStream]);

  useEffect(() => {
    if (!scanOpen || barcodeSupport !== 'checking') return;
    const Detector = getBarcodeDetector();
    const getFormats = Detector?.getSupportedFormats;
    if (!Detector || !getFormats) return;

    let cancelled = false;
    void getFormats
      .call(Detector)
      .then(formats => {
        if (!cancelled) {
          setBarcodeSupport(formats.includes('code_39') ? 'supported' : 'unsupported');
        }
      })
      .catch(() => {
        if (!cancelled) setBarcodeSupport('supported');
      });
    return () => {
      cancelled = true;
    };
  }, [scanOpen, barcodeSupport]);

  // Poll for a Code 39 VIN, but require two matching reads before accepting it.
  useEffect(() => {
    if (!scanOpen || !cameraStream || barcodeSupport !== 'supported') return;
    const video = videoRef.current;
    if (!video) return;
    const Detector = getBarcodeDetector();
    if (!Detector) return;

    let cancelled = false;
    let timer = 0;
    let lastValue = '';
    let stableFrames = 0;
    let reportedStatus = '';
    const detector = new Detector({ formats: ['code_39'] });

    const detect = async () => {
      if (cancelled) return;
      if (!ocrAbortRef.current) {
        try {
          const barcodes = await detector.detect(video);
          if (cancelled) return;
          const candidate = barcodes
            .map(barcode =>
              normalizeVinOcrText(barcode.rawValue ?? '').replace(/[^A-HJ-NPR-Z0-9]/g, ''),
            )
            .find(value => value.length === 17);

          if (candidate) {
            stableFrames = candidate === lastValue ? stableFrames + 1 : 1;
            lastValue = candidate;
            const nextStatus =
              stableFrames >= 2
                ? 'VIN barcode confirmed — opening the decoder…'
                : 'VIN barcode detected — hold steady to confirm…';
            if (nextStatus !== reportedStatus) {
              reportedStatus = nextStatus;
              setBarcodeStatus(nextStatus);
            }
            if (stableFrames >= 2) {
              setVin(candidate);
              trackEvent('vin_camera_scanned', { stableFrames });
              closeCamera();
              window.setTimeout(() => inputRef.current?.focus(), 0);
              return;
            }
          } else {
            lastValue = '';
            stableFrames = 0;
            if (reportedStatus) {
              reportedStatus = '';
              setBarcodeStatus(null);
            }
          }
        } catch {
          // A frame can fail while the camera is focusing; keep polling.
        }
      }
      timer = window.setTimeout(detect, 250);
    };

    timer = window.setTimeout(detect, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [scanOpen, cameraStream, barcodeSupport, closeCamera]);

  const captureOcr = useCallback(async () => {
    if (ocrAbortRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setOcrError('The camera is not ready yet. Wait a moment and try again.');
      return;
    }
    const controller = new AbortController();
    ocrAbortRef.current = controller;
    setOcrBusy(true);
    setOcrError(null);
    setOcrProgress(0);
    setOcrStatus('Preparing image…');
    try {
      const canvas = createVinOcrCanvas(video, guideRef.current);

      const candidates = await recognizeVinFromImage(
        canvas,
        progress => {
          if (controller.signal.aborted) return;
          setOcrStatus(progress.status);
          setOcrProgress(progress.progress);
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!candidates.length) {
        setOcrError(
          'No VIN-like text was found. Align the VIN inside the frame, avoid glare, and try again.',
        );
        return;
      }
      setOcrResult({ candidates, selected: candidates[0].vin });
      closeCamera();
      trackEvent('vin_camera_ocr_captured', {
        validCheckDigit: candidates[0].validCheckDigit,
        candidates: candidates.length,
      });
    } catch {
      if (controller.signal.aborted) return;
      setOcrError('OCR could not read this image. Try again with more light and less glare.');
    } finally {
      if (ocrAbortRef.current === controller) {
        ocrAbortRef.current = null;
        setOcrBusy(false);
        setOcrStatus(null);
        setOcrProgress(0);
      }
    }
  }, [closeCamera]);

  // Update the live quality hint and, when requested, auto-read a steady frame.
  useEffect(() => {
    if (!scanOpen || !cameraStream) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let timer = 0;
    autoAttemptedRef.current = false;
    stableFramesRef.current = 0;
    lastSignatureRef.current = null;

    const tick = () => {
      if (cancelled) return;
      if (!ocrAbortRef.current) {
        const sample = measureVinFrameQuality(video, guideRef.current);
        if (sample) {
          setQuality(current =>
            current?.level === sample.level
              ? current
              : { level: sample.level, message: sample.message },
          );
          if (autoRead && !autoAttemptedRef.current) {
            if (sample.level === 'good') {
              const previous = lastSignatureRef.current;
              const motion = previous ? frameSignatureDelta(previous, sample.signature) : 255;
              stableFramesRef.current = motion <= 6 ? stableFramesRef.current + 1 : 0;
              lastSignatureRef.current = sample.signature;
              if (stableFramesRef.current >= 3) {
                autoAttemptedRef.current = true;
                trackEvent('vin_camera_auto_capture');
                void captureOcr();
                return;
              }
            } else {
              stableFramesRef.current = 0;
              lastSignatureRef.current = null;
            }
          }
        }
      }
      timer = window.setTimeout(tick, 450);
    };

    timer = window.setTimeout(tick, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [scanOpen, cameraStream, autoRead, captureOcr]);

  const handlePhotoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || ocrAbortRef.current) return;

    setCameraError(null);
    setOcrError(null);
    setOcrResult(null);
    setPhotoStatus(null);
    if (file.type && !SUPPORTED_PHOTO_TYPES.has(file.type)) {
      setCameraError(PHOTO_TYPE_ERROR);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setCameraError(PHOTO_TOO_LARGE_ERROR);
      return;
    }

    const controller = new AbortController();
    ocrAbortRef.current = controller;
    setPhotoBusy(true);
    setPhotoStatus('Preparing photo…');

    try {
      const canvas = await createVinOcrCanvasFromFile(file);
      if (controller.signal.aborted) return;
      const candidates = await recognizeVinFromImage(
        canvas,
        progress => {
          if (!controller.signal.aborted) setPhotoStatus(progress.status);
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!candidates.length) {
        setCameraError(
          'No VIN-like text was found in that photo. Try a closer, sharper photo without glare, or enter the VIN manually.',
        );
        return;
      }
      setOcrResult({ candidates, selected: candidates[0].vin });
      trackEvent('vin_camera_photo_ocr', { validCheckDigit: candidates[0].validCheckDigit });
    } catch {
      if (!controller.signal.aborted) {
        setCameraError('That photo could not be read. Try another image with the VIN in focus.');
      }
    } finally {
      if (ocrAbortRef.current === controller) {
        ocrAbortRef.current = null;
        setPhotoBusy(false);
        setPhotoStatus(null);
      }
    }
  };

  useEffect(() => () => {
    ocrAbortRef.current?.abort();
    ocrAbortRef.current = null;
    stopStream(streamRef.current);
  }, []);

  const selectReviewVin = (next: string) => {
    setOcrResult(current => (current ? { ...current, selected: next } : current));
  };

  const useOcrResult = useCallback(() => {
    if (!ocrResult || ocrResult.selected.length !== 17) return;
    setVin(ocrResult.selected);
    setOcrResult(null);
    setScanning(false);
    inputRef.current?.focus();
    trackEvent('vin_camera_ocr_used', {
      validCheckDigit: hasValidVinCheckDigit(ocrResult.selected),
      edited: !ocrResult.candidates.some(candidate => candidate.vin === ocrResult.selected),
    });
  }, [ocrResult]);

  const isValid = vin.length === 17;
  const isActive = loading || scanning;

  return (
    <div className={styles.wrapper}>
      {/* VIN Structure Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem} title="World Manufacturer Identifier">
          <span className={styles.legendBracket}>[</span>
          <span className={`${styles.legendLabel} ${styles.wmi}`}>WMI</span>
          <span className={styles.legendBracket}>]</span>
        </span>
        <span className={styles.legendItem} title="Vehicle Descriptor Section">
          <span className={styles.legendBracket}>[</span>
          <span className={`${styles.legendLabel} ${styles.vds}`}>VDS</span>
          <span className={styles.legendBracket}>]</span>
        </span>
        <span className={styles.legendItem} title="Vehicle Identifier Section">
          <span className={styles.legendBracket}>[</span>
          <span className={`${styles.legendLabel} ${styles.vis}`}>VIS</span>
          <span className={styles.legendBracket}>]</span>
        </span>
      </div>

      {/* VIN Display (character breakdown) */}
      <div
        className={styles.vinDisplay}
        role="group"
        aria-label="VIN character breakdown"
        tabIndex={0}
      >
        {Array.from({ length: 17 }).map((_, i) => {
          const char = vin[i] || '';
          const isScanned = scanIndex >= 0 && i <= scanIndex;
          const isScanning = scanIndex === i;
          const isWMI = i < 3;
          const isVDS = i >= 3 && i < 9;

          return (
            <div
              key={i}
              className={`
                ${styles.vinChar}
                ${isWMI ? styles.wmiChar : ''}
                ${isVDS ? styles.vdsChar : styles.visChar}
                ${isScanned ? styles.scanned : ''}
                ${isScanning ? styles.scanning : ''}
                ${char ? styles.filled : ''}
              `}
            >
              <span className={styles.charValue}>{char || '·'}</span>
              <span className={styles.charIndex}>{i + 1}</span>
            </div>
          );
        })}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          <Search size={18} className={styles.inputIcon} />
          <input
            ref={inputRef}
            type="text"
            className={`${styles.vinInput} ${error ? styles.vinInputError : ''} ${isValid ? styles.vinInputValid : ''}`}
            aria-label="Vehicle Identification Number (VIN)"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'vin-error' : undefined}
            value={vin}
            onChange={handleInput}
            placeholder={`Try: ${SAMPLE_VINS[hintIndex]}`}
            disabled={isActive}
            maxLength={17}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
          />
          <span className={styles.charCount}>
            <span className={vin.length === 17 ? styles.countDone : ''}>{vin.length}</span>/17
          </span>
        </div>

        <button
          type="submit"
          className={`btn btn-primary ${styles.decodeBtn}`}
          disabled={!isValid || isActive}
        >
          {isActive ? (
            <>
              <Loader2 size={16} className={styles.spin} />
              {scanning ? 'Scanning…' : 'Decoding…'}
            </>
          ) : (
            <>
              <Search size={16} />
              Decode VIN
            </>
          )}
        </button>
      </form>

      {/* Error */}
      {error && !isActive && (
        <div id="vin-error" role="alert" className={styles.error}>
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Sample VIN helper */}
      {!vin && (
        <div className={styles.hint}>
          <span className={styles.hintText}>No VIN? Try a sample:</span>
          <button onClick={useSample} className={styles.hintBtn}>
            {SAMPLE_VINS[hintIndex]}
          </button>
        </div>
      )}

      <div className={styles.cameraActions}>
        <button
          ref={scanButtonRef}
          type="button"
          className="btn btn-ghost"
          onClick={() => void startCamera()}
          disabled={isActive || cameraBusy || photoBusy || scanOpen}
        >
          {cameraBusy ? <Loader2 size={15} className={styles.spin} /> : <Camera size={15} />}
          {cameraBusy ? 'Opening camera…' : 'Scan VIN with camera'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => photoInputRef.current?.click()}
          disabled={isActive || cameraBusy || photoBusy || scanOpen}
        >
          {photoBusy ? <Loader2 size={15} className={styles.spin} /> : <ImagePlus size={15} />}
          {photoBusy ? 'Reading photo…' : 'Upload a VIN photo'}
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp"
          className={styles.photoInput}
          tabIndex={-1}
          aria-hidden="true"
          onChange={event => void handlePhotoFile(event)}
        />
        <span className={styles.cameraHint}>
          Scan a Code 39 barcode, read the printed VIN with OCR, or upload a photo.
        </span>
      </div>
      {photoStatus && (
        <p className={styles.cameraHint} role="status">{photoStatus}</p>
      )}
      {cameraError && (
        <p className={styles.cameraError} role="status">{cameraError}</p>
      )}
      {ocrResult && (
        <VINOcrReview
          candidates={ocrResult.candidates}
          selected={ocrResult.selected}
          onSelect={selectReviewVin}
          onUse={useOcrResult}
          onRetake={() => {
            setOcrResult(null);
            void startCamera();
          }}
          onUpload={() => photoInputRef.current?.click()}
        />
      )}

      {scanOpen &&
        createPortal(
          <div
            ref={modalRef}
            className={styles.cameraOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vin-camera-title"
            tabIndex={-1}
          >
          <div className={styles.cameraModal}>
            <div className={styles.cameraHeader}>
              <div>
                <h2 id="vin-camera-title" className={styles.cameraTitle}>Read a VIN</h2>
                <p className={styles.cameraSub}>
                  Hold steady over the Code 39 barcode, or align the printed VIN inside the guide
                  and read the text.
                </p>
              </div>
              <button
                type="button"
                className={styles.cameraClose}
                onClick={cancelCamera}
                aria-label="Cancel VIN camera scan"
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.cameraBody}>
              <div className={styles.cameraVideoWrap}>
                <video ref={videoRef} className={styles.cameraVideo} muted playsInline autoPlay />
                <div ref={guideRef} className={styles.cameraGuide} aria-hidden="true">
                  <span className={styles.cameraGuideLabel}>Align the VIN inside the frame</span>
                </div>
                {quality && (
                  <span
                    className={`${styles.qualityBadge} ${quality.level === 'good' ? styles.qualityGood : styles.qualityWarn}`}
                    role="status"
                  >
                    {quality.message}
                  </span>
                )}
                {!cameraStream && (
                  <div className={styles.cameraStopped} role="status">
                    <AlertCircle size={22} />
                    <span>Camera feed stopped</span>
                  </div>
                )}
              </div>
              {ocrError && (
                <p className={styles.ocrInlineError} role="alert">{ocrError}</p>
              )}
              {cameraInlineError && cameraStream && (
                <p className={styles.ocrInlineError} role="alert">{cameraInlineError}</p>
              )}
              {ocrBusy && (
                <div className={styles.ocrStatus} role="status">
                  <span>{ocrStatus || 'Reading VIN text…'}</span>
                  <div className={styles.ocrProgress}>
                    <span style={{ width: `${Math.round(ocrProgress * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className={styles.cameraFooterNotes}>
                <span>VIN is 17 characters; I, O, and Q are not used.</span>
                <span>Camera frames are processed on this device; no image is uploaded.</span>
                {barcodeSupport === 'unsupported' && (
                  <span className={styles.cameraNotice} role="status">
                    Barcode scanning isn’t available in this browser. Use “Read VIN text” or upload
                    a photo instead.
                  </span>
                )}
                {barcodeStatus && (
                  <span className={styles.cameraNotice} role="status">{barcodeStatus}</span>
                )}
              </div>
            </div>
            <div className={styles.cameraControls}>
              <label className={styles.autoRead}>
                <input
                  type="checkbox"
                  checked={autoRead}
                  onChange={event => setAutoRead(event.target.checked)}
                  disabled={!cameraStream}
                />
                Auto-read when steady
              </label>
                <div className={styles.cameraActions}>
                  {!cameraStream && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void retryCamera()}
                      disabled={cameraBusy}
                    >
                      {cameraBusy ? (
                        <Loader2 size={14} className={styles.spin} />
                      ) : (
                        <Camera size={14} />
                      )}
                      {cameraBusy ? 'Reconnecting…' : 'Reconnect camera'}
                    </button>
                  )}
                  {cameraStream && torchAvailable && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void toggleTorch()}
                      disabled={ocrBusy}
                    >
                      <Flashlight size={14} />
                      {torchOn ? 'Turn off torch' : 'Turn on torch'}
                    </button>
                  )}
                  {cameraStream && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void switchCamera()}
                      disabled={cameraSwitching || ocrBusy}
                    >
                      {cameraSwitching ? (
                        <Loader2 size={14} className={styles.spin} />
                      ) : (
                        <SwitchCamera size={14} />
                      )}
                      {cameraSwitching ? 'Switching…' : 'Switch camera'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      cancelCamera();
                      photoInputRef.current?.click();
                    }}
                    disabled={ocrBusy}
                  >
                    <ImagePlus size={14} /> Use a photo
                  </button>
                </div>
              </div>
            <div className={styles.cameraFooter}>
              {!cameraStream && (
                <p className={styles.cameraRecovery} role="alert">
                  {cameraInlineError ??
                    'The camera stopped. Reconnect the camera or use a photo instead.'}
                </p>
              )}
              <div className={styles.cameraActions}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void captureOcr()}
                  disabled={!cameraStream || ocrBusy}
                >
                  {ocrBusy ? <Loader2 size={14} className={styles.spin} /> : <ScanText size={14} />}
                  {ocrBusy ? 'Reading…' : 'Read VIN text'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelCamera}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
