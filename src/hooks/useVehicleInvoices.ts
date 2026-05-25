import { useQuery } from '@tanstack/react-query';
import { fetchVehicleInvoices } from '@/api/fleet';
import type { VehicleInvoice } from '@/types/fleet';

export function useVehicleInvoices(vehicleId: number | null) {
  return useQuery<VehicleInvoice[]>({
    queryKey: ['vehicle-invoices', vehicleId],
    queryFn: () => fetchVehicleInvoices(vehicleId as number),
    enabled: vehicleId !== null,
    staleTime: 5 * 60 * 1000,
  });
}
