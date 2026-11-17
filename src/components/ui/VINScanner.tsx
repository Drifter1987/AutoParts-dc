import { useState, useEffect, useRef } from 'react';
import { Search, AlertCircle, Loader2, Camera, X } from 'lucide-react';
import { trackEvent } from '../../services/telemetry';
import styles from './VINScanner.module.css';

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

interface VINScannerProps {
  onDecode: (vin: string) => void;
  loading: boolean;
  error: string | null;
  initialVin?: string;
}

// Sample VINs for the placeholder hint
const SAMPLE_VINS = [
  '4T1BF3EK8AU561547', // Toyota
  '1FTFW1ET5DFC43861', // Ford
  '2HGFC2F59JH531528', // Honda
  'WBAVB13516PT18676', // BMW
  '1VWFE21C04M000001', // VW
];

export default function VINScanner({ onDecode, loading, error, initialVin = '' }: VINScannerProps) {
  const [vin, setVin] = useState(initialVin);
  const [scanning, setScanning] = useState(false);
  const [scanIndex, setScanIndex] = useState(-1);
  const [hintIndex, setHintIndex] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    const val = e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    setVin(val.slice(0, 17));
  };

  const useSample = () => {
    setVin(SAMPLE_VINS[hintIndex]);
    inputRef.current?.focus();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    setScanOpen(false);
    setCameraBusy(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) {
      setCameraError('VIN barcode scanning is not supported in this browser. Enter the VIN manually or try Chrome/Edge on Android.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available. Enter the VIN manually.');
      return;
    }
    try {
      new Detector({ formats: ['code_39'] });
    } catch {
      setCameraError('This browser cannot scan Code 39 VIN barcodes. Enter the VIN manually.');
      return;
    }

    setCameraBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraStream(stream);
      setScanOpen(true);
      trackEvent('vin_camera_opened');
    } catch {
      setCameraError('Camera permission was denied or no camera is available. Enter the VIN manually.');
    } finally {
      setCameraBusy(false);
    }
  };

  // Attach the stream after the modal has mounted, then poll frames for a Code 39 VIN.
  useEffect(() => {
    if (!scanOpen || !cameraStream) return;
    const video = videoRef.current;
    if (!video) return;

    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) return;

    let frame = 0;
    let cancelled = false;
    const detector = new Detector({ formats: ['code_39'] });

    video.srcObject = cameraStream;
    void video.play().catch(() => {});

    const detect = async () => {
      if (cancelled) return;
      try {
        const barcodes = await detector.detect(video);
        const candidate = barcodes
          .map(barcode => barcode.rawValue?.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ''))
          .find(value => value && value.length === 17);
        if (candidate) {
          setVin(candidate);
          stopCamera();
          inputRef.current?.focus();
          trackEvent('vin_camera_scanned');
          return;
        }
      } catch {
        // A frame can fail while the camera is focusing; keep polling.
      }
      frame = requestAnimationFrame(detect);
    };

    frame = requestAnimationFrame(detect);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [scanOpen, cameraStream]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

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
      <div className={styles.vinDisplay}>
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
          type="button"
          className="btn btn-ghost"
          onClick={startCamera}
          disabled={isActive || cameraBusy}
        >
          {cameraBusy ? <Loader2 size={15} className={styles.spin} /> : <Camera size={15} />}
          {cameraBusy ? 'Opening camera…' : 'Scan VIN with camera'}
        </button>
        <span className={styles.cameraHint}>Use the door-jamb or windshield VIN barcode (Code 39).</span>
      </div>
      {cameraError && (
        <p className={styles.cameraError} role="status">{cameraError}</p>
      )}

      {scanOpen && (
        <div className={styles.cameraOverlay} role="dialog" aria-modal="true" aria-labelledby="vin-camera-title">
          <div className={styles.cameraModal}>
            <div className={styles.cameraHeader}>
              <div>
                <h2 id="vin-camera-title" className={styles.cameraTitle}>Scan a VIN barcode</h2>
                <p className={styles.cameraSub}>Hold the camera steady over the Code 39 barcode.</p>
              </div>
              <button
                type="button"
                className={styles.cameraClose}
                onClick={stopCamera}
                aria-label="Cancel VIN camera scan"
              >
                <X size={20} />
              </button>
            </div>
            <video ref={videoRef} className={styles.cameraVideo} muted playsInline autoPlay />
            <div className={styles.cameraFooter}>
              <span>VIN is 17 characters; I, O, and Q are not used.</span>
              <button type="button" className="btn btn-ghost" onClick={stopCamera}>Cancel scan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
