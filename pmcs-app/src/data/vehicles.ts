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
    type: 'M1097',
    name: 'M1097 HMMWV Heavy Variant',
    nickname: 'Humvee (Heavy)',
    tmReference: 'TM 9-2320-280-10',
    tmDate: '20040715', // Change 3, 15 July 2004 (armypubs: "REPRINTED W/BASIC INCL C1-3")
    tmBaseDate: '19960131', // 31 January 1996
    tmChange: 3,
    itemCount: 59, // Table 2-2 items applicable to M1097/A1/A2: 12 Before, 6 During, 19 After, 16 Weekly, 6 Monthly
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
    tmDate: '20100915', // 15 September 2010 edition
    tmBaseDate: '20100915', // 15 September 2010
    tmChange: 0,
    itemCount: 40,
  },
  {
    type: 'MEP802A',
    name: 'MEP-802A/812A Generator (5kW)',
    nickname: 'Generator (5kW)',
    tmReference: 'TM 9-6115-641-10',
    tmDate: '20091015', // 15 October 2009 (revised edition, no changes; supersedes 30 Dec 1992 incl. all changes)
    tmBaseDate: '20091015',
    tmChange: 0,
    itemCount: 66,
  },
  {
    type: 'MEP1030',
    name: 'MEP-1030/1031 AMMPS Generator (5kW)',
    nickname: 'AMMPS (5kW)',
    tmReference: 'TM 9-6115-749-10',
    tmDate: '20110201', // 1 February 2011 (original, no changes)
    tmBaseDate: '20110201',
    tmChange: 0,
    itemCount: 91,
  },
  {
    type: 'MEP831A',
    name: 'MEP-831A/832A Generator (3kW)',
    nickname: 'Generator (3kW)',
    tmReference: 'TM 9-6115-639-13&P',
    tmDate: '20100430', // 30 April 2010 (revised edition, no changes)
    tmBaseDate: '20100430',
    tmChange: 0,
    itemCount: 24,
  },
];
