import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlayCircle, ChevronLeft } from 'lucide-react';
import { useUserStore } from '../stores/userStore';
import { useSessionStore, getPersistedSession } from '../stores/sessionStore';
import { db } from '../utils/db';
import { Button } from '../components/ui/Button';
import type { InspectionSession, VehicleType } from '../types';

import m1151Home from '../assets/images/m1151/m1151-home.jpg';
import m1078Home from '../assets/images/m1078/m1078-home.jpg';
import m1101Home from '../assets/images/m1101/m1101-home.jpg';
import mep803aHome from '../assets/images/mep803a/mep803a-home.jpg';

// Vehicle family → variant structure
interface VehicleVariant {
  type: VehicleType;
  name: string;
  hint: string;
  itemCount: number;
}

interface VehicleFamily {
  id: string;
  name: string;
  image: string;
  variants: VehicleVariant[];
}

const VEHICLE_FAMILIES: VehicleFamily[] = [
  {
    id: 'hmmwv',
    name: 'HMMWV',
    image: m1151Home,
    variants: [
      {
        type: 'M1151',
        name: 'M1151 / M1151A1',
        hint: 'Up-Armored — hardened doors, turret ring, ballistic glass',
        itemCount: 21,
      },
      {
        type: 'M1152',
        name: 'M1152 / M1152A1',
        hint: 'Shelter Carrier — soft-top or expandable shelter on back',
        itemCount: 20,
      },
    ],
  },
  {
    id: 'fmtv',
    name: 'LMTV / FMTV',
    image: m1078Home,
    variants: [
      {
        type: 'LMTV_M1078',
        name: 'M1078 LMTV',
        hint: '2.5-ton cargo truck — the standard "deuce and a half"',
        itemCount: 24,
      },
    ],
  },
  {
    id: 'trailer',
    name: 'Cargo Trailer',
    image: m1101Home,
    variants: [
      {
        type: 'M1101_TRAILER',
        name: 'M1101 / M1102',
        hint: '3/4-ton and 1¼-ton cargo trailers',
        itemCount: 19,
      },
    ],
  },
  {
    id: 'generator',
    name: 'Generator',
    image: mep803aHome,
    variants: [
      {
        type: 'MEP803A',
        name: 'MEP-803A / MEP-813A',
        hint: '10kW Tactical Quiet Generator Set',
        itemCount: 40,
      },
    ],
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const restoreSession = useSessionStore((s) => s.restoreSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  const [pendingSession, setPendingSession] = useState<InspectionSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<VehicleFamily | null>(null);

  useEffect(() => {
    const persisted = getPersistedSession();
    if (!persisted) return;
    db.sessions.get(persisted.sessionId).then((session) => {
      if (session && session.status === 'IN_PROGRESS') {
        setPendingSession(session);
      } else {
        clearSession();
      }
    });
  }, [clearSession]);

  const handleResume = async () => {
    if (!pendingSession) return;
    setIsRestoring(true);
    const restored = await restoreSession(pendingSession.id);
    if (restored) {
      navigate(`/session/${pendingSession.id}/pmcs`);
    } else {
      setPendingSession(null);
      setIsRestoring(false);
    }
  };

  const handleDiscard = () => {
    clearSession();
    setPendingSession(null);
  };

  // Step 2: variant selection
  if (selectedFamily) {
    // If only one variant, skip straight to session setup
    if (selectedFamily.variants.length === 1) {
      navigate(`/session/new?vehicle=${selectedFamily.variants[0].type}`);
      return null;
    }

    return (
      <div className="flex flex-col h-full px-4 pt-6 pb-4 overflow-y-auto">
        <button
          onClick={() => setSelectedFamily(null)}
          className="flex items-center gap-1 text-accent-blue text-sm mb-4 min-h-[44px]"
        >
          <ChevronLeft size={18} />
          Back
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold font-display text-text-primary">
            Which {selectedFamily.name}?
          </h1>
          <p className="mt-1 text-text-secondary text-sm">
            Not sure? Check the data plate on the driver's door frame.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {selectedFamily.variants.map((variant, index) => (
            <motion.button
              key={variant.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/session/new?vehicle=${variant.type}`)}
              className="bg-bg-secondary border border-border rounded-[var(--radius-lg)] p-4 text-left active:border-accent-blue transition-colors"
            >
              <h2 className="text-lg font-bold font-display text-text-primary">
                {variant.name}
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                {variant.hint}
              </p>
              <p className="text-text-secondary/70 text-xs mt-2">
                ~{variant.itemCount} check items
              </p>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // Step 1: family selection
  return (
    <div className="flex flex-col h-full px-4 pt-6 pb-4 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-text-primary">
          What are you PMCSing?
        </h1>
        {user && (
          <p className="mt-1 text-text-secondary text-sm">
            {user.rank} {user.lastName}
          </p>
        )}
      </div>

      {pendingSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-accent-blue/10 border border-accent-blue/30 rounded-[var(--radius-lg)] p-4 mb-4"
        >
          <div className="flex items-start gap-3">
            <PlayCircle size={24} className="text-accent-blue flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">
                Inspection in progress
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {pendingSession.vehicleType} — {pendingSession.bumperNumber} — {pendingSession.date}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" size="default" fullWidth onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="default" fullWidth onClick={handleResume} disabled={isRestoring}>
              {isRestoring ? 'Restoring...' : 'Resume'}
            </Button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col gap-3">
        {VEHICLE_FAMILIES.map((family, index) => (
          <motion.button
            key={family.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.15, ease: 'easeOut' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedFamily(family)}
            className="flex flex-col bg-bg-secondary border border-border rounded-[var(--radius-lg)] overflow-hidden text-left active:border-accent-blue transition-colors"
          >
            <div className="h-44 overflow-hidden">
              <img
                src={family.image}
                alt={family.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4">
              <h2 className="text-lg font-bold font-display text-text-primary">
                {family.name}
              </h2>
              <p className="text-text-secondary/70 text-xs mt-1">
                {family.variants.length === 1
                  ? family.variants[0].name
                  : `${family.variants.length} variants`
                }
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
