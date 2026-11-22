import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import {
  GARAGE_WRITE_FAILED_MESSAGE,
  garageChangedEvent,
  isVehicleSaved,
  removeVehicle,
  saveVehicle,
} from '../../services/garage';
import { trackEvent } from '../../services/telemetry';
import type { VINDecodeResult } from '../../types';

interface SaveVehicleButtonProps {
  result: VINDecodeResult;
  className?: string;
}

export default function SaveVehicleButton({ result, className }: SaveVehicleButtonProps) {
  const [saved, setSaved] = useState(() => isVehicleSaved(result.vin));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onChange = () => {
      setSaved(isVehicleSaved(result.vin));
      setError(null);
    };
    window.addEventListener(garageChangedEvent(), onChange);
    return () => window.removeEventListener(garageChangedEvent(), onChange);
  }, [result.vin]);

  const toggle = () => {
    if (saved) {
      if (!removeVehicle(result.vin)) {
        setError(GARAGE_WRITE_FAILED_MESSAGE);
        return;
      }
      setError(null);
      trackEvent('garage_vehicle_removed', { vin: result.vin });
    } else {
      if (!saveVehicle(result)) {
        setError(GARAGE_WRITE_FAILED_MESSAGE);
        return;
      }
      setError(null);
      trackEvent('garage_vehicle_saved', { vin: result.vin, year: result.year, make: result.make });
    }
  };

  return (
    <>
      <button type="button" className={className || 'btn btn-ghost'} onClick={toggle}>
        {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        {saved ? 'Saved to My Garage' : 'Save to My Garage'}
      </button>
      {error && (
        <p
          role="alert"
          style={{
            flexBasis: '100%',
            margin: 0,
            color: 'var(--error)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      )}
    </>
  );
}
