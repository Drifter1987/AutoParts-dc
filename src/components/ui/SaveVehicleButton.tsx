import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { garageChangedEvent, isVehicleSaved, removeVehicle, saveVehicle } from '../../services/garage';
import { trackEvent } from '../../services/telemetry';
import type { VINDecodeResult } from '../../types';

interface SaveVehicleButtonProps {
  result: VINDecodeResult;
  className?: string;
}

export default function SaveVehicleButton({ result, className }: SaveVehicleButtonProps) {
  const [saved, setSaved] = useState(() => isVehicleSaved(result.vin));

  useEffect(() => {
    const onChange = () => setSaved(isVehicleSaved(result.vin));
    window.addEventListener(garageChangedEvent(), onChange);
    return () => window.removeEventListener(garageChangedEvent(), onChange);
  }, [result.vin]);

  const toggle = () => {
    if (saved) {
      removeVehicle(result.vin);
      trackEvent('garage_vehicle_removed', { vin: result.vin });
    } else {
      saveVehicle(result);
      trackEvent('garage_vehicle_saved', { vin: result.vin, year: result.year, make: result.make });
    }
  };

  return (
    <button type="button" className={className || 'btn btn-ghost'} onClick={toggle}>
      {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
      {saved ? 'Saved to My Garage' : 'Save to My Garage'}
    </button>
  );
}
