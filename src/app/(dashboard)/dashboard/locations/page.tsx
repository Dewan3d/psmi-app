// ============================================================
// PSMI System — Active Locations Cards Page
// ============================================================

import { getInventoryByLocation } from '@/actions/dashboard';
import LocationsClient from './LocationsClient';

export default async function LocationsPage() {
  const locationData = await getInventoryByLocation();

  return (
    <LocationsClient
      locations={locationData.data || []}
    />
  );
}
