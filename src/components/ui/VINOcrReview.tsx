import { ImagePlus, RotateCcw } from 'lucide-react';
import {
  hasValidVinCheckDigit,
  sanitizeVinInput,
  suggestVinCorrections,
  type VinCandidate,
} from '../../services/vinOcr';
import styles from './VINScanner.module.css';

const MAX_ALTERNATES = 4;

interface VINOcrReviewProps {
  candidates: VinCandidate[];
  selected: string;
  onSelect: (vin: string) => void;
  onUse: () => void;
  onRetake: () => void;
  onUpload: () => void;
}

export default function VINOcrReview({
  candidates,
  selected,
  onSelect,
  onUse,
  onRetake,
  onUpload,
}: VINOcrReviewProps) {
  const complete = selected.length === 17;
  const valid = complete && hasValidVinCheckDigit(selected);
  const suggestions = complete && !valid ? suggestVinCorrections(selected) : [];
  const alternates = candidates.filter(candidate => candidate.vin !== selected).slice(0, MAX_ALTERNATES);

  return (
    <div className={styles.ocrReview} role="group" aria-label="Review the VIN read from the camera">
      <div className={styles.ocrReviewCopy}>
        <strong>Review the VIN read from the image</strong>
        <input
          className={styles.ocrVinInput}
          aria-label="VIN read from the camera"
          value={selected}
          onChange={event => onSelect(sanitizeVinInput(event.target.value))}
          maxLength={17}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          autoFocus
        />
        {!complete ? (
          <span className={styles.ocrWarning}>
            The VIN needs 17 characters before it can be used.
          </span>
        ) : valid ? (
          <span className={styles.ocrValid}>
            Check digit is valid — still confirm it matches the door jamb.
          </span>
        ) : (
          <span className={styles.ocrWarning}>
            Check digit does not validate. Compare every character before using it.
          </span>
        )}
        {alternates.length > 0 && (
          <div className={styles.ocrAlternates}>
            <span>Other reads from this image:</span>
            <div className={styles.ocrSuggestionList}>
              {alternates.map(candidate => (
                <button
                  key={candidate.vin}
                  type="button"
                  className={styles.ocrSuggestion}
                  onClick={() => onSelect(candidate.vin)}
                >
                  {candidate.vin}
                </button>
              ))}
            </div>
          </div>
        )}
        {suggestions.length > 0 && (
          <div className={styles.ocrSuggestions}>
            <span>Possible correction if a character was misread:</span>
            <div className={styles.ocrSuggestionList}>
              {suggestions.map(candidate => (
                <button
                  key={candidate.vin}
                  type="button"
                  className={styles.ocrSuggestion}
                  onClick={() => onSelect(candidate.vin)}
                >
                  {candidate.vin}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={styles.cameraActions}>
        <button type="button" className="btn btn-primary" onClick={onUse} disabled={!complete}>
          Use this VIN
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRetake}>
          <RotateCcw size={14} /> Retake
        </button>
        <button type="button" className="btn btn-ghost" onClick={onUpload}>
          <ImagePlus size={14} /> Upload another photo
        </button>
      </div>
      <p className={styles.ocrPrivacy}>
        The image is processed in your browser by the OCR engine. No photo is uploaded by this app.
      </p>
    </div>
  );
}
