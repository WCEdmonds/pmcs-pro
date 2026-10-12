import type { VehicleRegistryEntry } from '../types';

/**
 * Registry entry plus the TM publication data for the DA 2404 "TM NUMBER / TM DATE" block.
 *
 * tmDate convention: YYYYMMDD of the LATEST CHANGE in force (the date of the TM as currently
 * changed — what the operator is actually inspecting against). The base edition date and change
 * number are kept alongside so the form or a reviewer can use the base date instead if the unit's
 * convention requires it. All dates verified from each TM's cover / change pages in the repo PDFs.
 */
export interface VehicleRegistryEntryWithTm extends VehicleRegistryEntry {
  /** YYYYMMDD — latest change date (base date if no changes). */
  tmDate: string;
  /** YYYYMMDD — base edition date. */
  tmBaseDate: string;
  /** Latest change number in force (0 = base edition). */
  tmChange: number;
}

export const VEHICLE_REGISTRY: VehicleRegistryEntryWithTm[] = [
  {
    type: 'M1151',
    name: 'M1151 Up-Armored HMMWV',
    nickname: 'Humvee',
    tmReference: 'TM 9-2320-387-10',
    tmDate: '20090630', // Change 6, 30 June 2009
    tmBaseDate: '19971017', // 17 October 1997
    tmChange: 6,
    itemCount: 72,
  },
  {
    type: 'M1152',
    name: 'M1152 HMMWV Shelter Carrier',
    nickname: 'Humvee (Shelter)',
    tmReference: 'TM 9-2320-387-10',
    tmDate: '20090630', // Change 6, 30 June 2009
    tmBaseDate: '19971017',
    tmChange: 6,
    itemCount: 67,
  },
  {
    type: 'LMTV_M1078',
    name: 'LMTV M1078',
    nickname: 'LMTV',
    tmReference: 'TM 9-2320-365-10',
    tmDate: '20010531', // Change 1, 31 May 2001
    tmBaseDate: '19980617', // 17 June 1998
    tmChange: 1,
    itemCount: 87, // Table 2-1 items 1-75 (+1.1, 11.1, 41.1) and Table 2-2 items 1-3, 5-10
  },
  {
    type: 'M1101_TRAILER',
    name: 'M1101/M1102 Cargo Trailer',
    nickname: 'Trailer',
    tmReference: 'TM 9-2330-392-14&P',
    tmDate: '20010427', // Change 2, 27 April 2001
    tmBaseDate: '19951001', // 1 October 1995
    tmChange: 2,
    itemCount: 19,
  },
  {
    type: 'MEP803A',
    name: 'MEP-803A/813A Generator (10kW)',
    nickname: 'Generator',
    tmReference: 'TM 9-6115-642-10',
    tmDate: '19961030', // Change 2, 30 October 1996
    tmBaseDate: '19921230', // 30 December 1992
    tmChange: 2,
    itemCount: 40,
  },
];
