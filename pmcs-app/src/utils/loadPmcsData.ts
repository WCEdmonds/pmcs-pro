import type { PmcsVehicleData, VehicleType } from '../types';

export async function loadPmcsData(vehicleType: VehicleType): Promise<PmcsVehicleData> {
  switch (vehicleType) {
    case 'M1151': {
      const data = await import('../data/pmcs/m1151-hmmwv.json');
      return data.default as PmcsVehicleData;
    }
    case 'M1152': {
      const data = await import('../data/pmcs/m1152-hmmwv.json');
      return data.default as PmcsVehicleData;
    }
    case 'LMTV_M1078': {
      const data = await import('../data/pmcs/m1078-lmtv.json');
      return data.default as PmcsVehicleData;
    }
    case 'M1101_TRAILER': {
      const data = await import('../data/pmcs/m1101-trailer.json');
      return data.default as PmcsVehicleData;
    }
    case 'MEP803A': {
      const data = await import('../data/pmcs/mep803a-generator.json');
      return data.default as PmcsVehicleData;
    }
  }
}
