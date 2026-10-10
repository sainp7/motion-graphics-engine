import React from "react";
import {
  AppWindow,
  Archive,
  Box,
  Clock,
  Cloud,
  Cpu,
  Database,
  Globe,
  KeyRound,
  Layers,
  Activity,
  Monitor,
  Network,
  Search,
  Server,
  Signpost,
  Smartphone,
  Split,
  User,
  Users,
  Waves,
  Zap,
  Copy,
  DoorOpen,
} from "lucide-react";
import type { NODE_KINDS } from "../spec/schema";

type Kind = (typeof NODE_KINDS)[number];

/** Lucide (ISC licence) icons, one per node kind. Keep the vocabulary small and consistent. */
const ICONS: Record<Kind, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  client: Monitor,
  mobile: Smartphone,
  browser: AppWindow,
  user: User,
  users: Users,
  dns: Signpost,
  cdn: Globe,
  lb: Split,
  gateway: DoorOpen,
  service: Box,
  server: Server,
  worker: Cpu,
  cache: Zap,
  db: Database,
  replica: Copy,
  queue: Layers,
  stream: Waves,
  storage: Archive,
  search: Search,
  auth: KeyRound,
  cron: Clock,
  metrics: Activity,
  cloud: Cloud,
  generic: Network,
};

export const KindIcon: React.FC<{ kind: Kind; size: number; color: string }> = ({ kind, size, color }) => {
  const C = ICONS[kind] ?? Network;
  return <C size={size} color={color} strokeWidth={2.1} />;
};
