declare module 'lucide-react' {
  import type { ComponentType, SVGProps } from 'react';
  type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: string | number; strokeWidth?: string | number }>;
  export const ArrowRight: Icon;
  export const Award: Icon;
  export const BookOpen: Icon;
  export const Check: Icon;
  export const ChevronLeft: Icon;
  export const CircleCheck: Icon;
  export const Compass: Icon;
  export const Flame: Icon;
  export const Hammer: Icon;
  export const LayoutGrid: Icon;
  export const LockKeyhole: Icon;
  export const Plus: Icon;
  export const ShieldCheck: Icon;
  export const Sparkles: Icon;
  export const UserRound: Icon;
  export const Wallet: Icon;
  export const X: Icon;
}

declare module '*.py?raw' {
  const source: string;
  export default source;
}
