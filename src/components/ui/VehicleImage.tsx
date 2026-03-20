import { useState } from 'react';
import { Car } from 'lucide-react';
import { getVehicleImageUrl, getBrandColor } from '@/lib/vehicleImages';

interface VehicleImageProps {
  model: string;
  width?: number;
  height?: number;
  className?: string;
}

export function VehicleImage({ model, width = 64, height = 40, className = '' }: VehicleImageProps) {
  const [error, setError] = useState(false);
  const url = getVehicleImageUrl(model);
  const brandColor = getBrandColor(model);

  if (!url || error) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl shrink-0 ${className}`}
        style={{ width, height, background: brandColor.bg, border: `1px solid ${brandColor.border}` }}
      >
        <Car className="w-4 h-4 text-[#86868b]/50" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden shrink-0 ${className}`}
      style={{ width, height, background: brandColor.bg, border: `1px solid ${brandColor.border}` }}
    >
      <img
        src={url}
        alt={model}
        loading="lazy"
        onError={() => setError(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
