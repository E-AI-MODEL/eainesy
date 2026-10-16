'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  ShieldCheck,
  MessageSquareHeart,
  Swords,
  Network,
  ClipboardCheck,
  ScrollText,
  LayoutDashboard,
  Menu,
  BookOpen,
  FlaskConical,
  SlidersHorizontal,
  TriangleAlert,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { EainesyMark, EainesyWordmark } from '@/components/eainesy/logo';
import { ChatPanel } from '@/components/eainesy/chat-panel';
import { VerifyPanel } from '@/components/eainesy/verify-panel';
import { EvalPanel } from '@/components/eainesy/eval-panel';
import { KgPanel } from '@/components/eainesy/kg-panel';
import { HitlPanel } from '@/components/eainesy/hitl-panel';
import { LedgerPanel } from '@/components/eainesy/ledger-panel';
import { DashboardPanel } from '@/components/eainesy/dashboard-panel';
import { AboutPanel } from '@/components/eainesy/about-panel';
import { SteerPanel } from '@/components/eainesy/steer-panel';
import { ManualDialog } from '@/components/eainesy/manual-dialog';
import { DisclaimerDialog } from '@/components/eainesy/disclaimer-dialog';
import { LanguageProvider, LanguageToggle, useLang } from '@/components/language-provider';
import type { Dict } from '@/lib/i18n';

type SectionId = 'dashboard' | 'chat' | 'verify' | 'eval' | 'hitl' | 'kg' | 'ledger' | 'about' | 'steer';

interface SectionDef {
  id: SectionId;
  label: string;
  icon: typeof LayoutDashboard;
}

function sectionMeta(t: Dict): SectionDef[] {
  return [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'chat', label: t.nav.chat, icon: MessageSquareHeart },
    { id: 'verify', label: t.nav.verify, icon: ShieldCheck },
    { id: 'eval', label: t.nav.eval, icon: Swords },
    { id: 'hitl', label: t.nav.hitl, icon: ClipboardCheck },
    { id: 'kg', label: t.nav.kg, icon: Network },
    { id: 'ledger', label: t.nav.ledger, icon: ScrollText },
    { id: 'about', label: t.nav.about, icon: FlaskConical },
    { id: 'steer', label: t.nav.steer, icon: SlidersHorizontal },
  ];
}

/**
 * Één informatiemodel, overal terugkerend (sidebar, mobiel menu, dashboard-directory):
 * twee niveaus uit de Task 22/24-audits — gebruik (bezoeker) vs. onderzoek & verificatie
 * (onderzoeker) — plus een meta-groep. Vervangt de oude platte rij van negen tabs.
 */
const GROUP_USE: SectionId[] = ['dashboard', 'chat', 'steer'];
const GROUP_RESEARCH: SectionId[] = ['verify', 'eval', 'hitl', 'kg', 'ledger'];
const GROUP_META: SectionId[] = ['about'];

const ONBOARDED_KEY = 'eainesy.onboarded.v1';
/** Pre-rename key — read once as fallback so the "seen onboarding" flag survives the rename. */
const ONBOARDED_KEY_LEGACY = 'kwast.onboarded.v1';

/** Automatisch inklapbare zijbalk: breedte-beslissing + bewaarde handmatige keuze. */
const NAV_KEY = 'eainesy.navFull.v1';
const NAV_WIDE = 1280;

function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !(window.localStorage.getItem(ONBOARDED_KEY) ?? window.localStorage.getItem(ONBOARDED_KEY_LEGACY));
  } catch {
    return false;
  }
}

/** Gegroepeerde navigatielijst, gedeeld door sidebar (desktop) en sheet (mobiel). */
function NavGroup({
  label,
  ids,
  sections,
  active,
  onGo,
  dense,
}: {
  label: string;
  ids: SectionId[];
  sections: SectionDef[];
  active: SectionId;
  onGo: (id: SectionId) => void;
  dense?: boolean;
}) {
  return (
    <div className={dense ? 'mb-3' : 'mb-4'}>
      <p
        className={`mb-1 px-3 font-semibold uppercase tracking-wider text-slate-400 ${dense ? 'text-[9.5px]' : 'text-[10px]'}`}
      >
        {label}
      </p>
      <ul>
        {ids.map((id) => {
          const s = sections.find((x) => x.id === id);
          if (!s) return null;
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => onGo(s.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 font-medium text-blue-900'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <s.icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`}
                  aria-hidden
                />
                {s.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Shell() {
  const { t } = useLang();
  const [active, setActive] = useState<SectionId>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState<boolean>(shouldShowOnboarding);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  // Zijbalk: eerstvolgende paint vol (server-safe); na mount geldt: bewaarde
  // handmatige keuze, anders automatisch — rail onder 1280px, vol erboven.
  const [navFull, setNavFull] = useState(true);
  const navOverride = useRef<boolean | null>(null);
  const sections = sectionMeta(t);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NAV_KEY);
      if (stored === '1' || stored === '0') navOverride.current = stored === '1';
    } catch {
      // negeren
    }
    const apply = () => setNavFull(navOverride.current ?? window.innerWidth >= NAV_WIDE);
    apply();
    const mq = window.matchMedia(`(min-width: ${NAV_WIDE}px)`);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const toggleNav = () => {
    const next = !navFull;
    navOverride.current = next;
    setNavFull(next);
    try {
      window.localStorage.setItem(NAV_KEY, next ? '1' : '0');
    } catch {
      // negeren
    }
  };

  const handleManualChange = (open: boolean) => {
    setManualOpen(open);
    if (!open) {
      try {
        window.localStorage.setItem(ONBOARDED_KEY, '1');
      } catch {
        // negeren
      }
    }
  };

  const go = (id: string) => {
    setActive(id as SectionId);
    setMenuOpen(false);
  };

  const navGroupsProps = { sections, active, onGo: go };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50 text-slate-900">
      {/* ── Header — rustig: alleen merk + taal + handleiding ── */}
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-2.5 px-3 md:px-4">
          <EainesyMark className="h-8 w-8" />
          <EainesyWordmark className="mr-auto text-[17px] tracking-tight md:text-lg" />

          {/* Taal-toggle NL | EN */}
          <LanguageToggle />

          {/* Handleiding-knop */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => setManualOpen(true)}
            aria-label={t.header.openManual}
          >
            <BookOpen className="h-4.5 w-4.5" aria-hidden />
          </Button>

          {/* Mobiel menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 md:hidden"
                aria-label={t.header.openMenu}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-80 flex-col p-0">
              <SheetHeader className="border-b border-slate-200 px-4 py-4 text-left">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <EainesyMark className="h-7 w-7" />
                  <EainesyWordmark className="text-base" />
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800 hover:bg-amber-50">
                    {t.common.demoBadge}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs">{t.header.menuSubtitle}</SheetDescription>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto p-3" aria-label={t.header.sections}>
                <NavGroup dense label={t.nav.groupUse} ids={GROUP_USE} {...navGroupsProps} />
                <NavGroup dense label={t.nav.groupResearch} ids={GROUP_RESEARCH} {...navGroupsProps} />
                <NavGroup dense label={t.nav.groupMeta} ids={GROUP_META} {...navGroupsProps} />
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setDisclaimerOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <TriangleAlert className="h-4 w-4 text-rose-500" aria-hidden />
                  {t.disclaimer.chip}
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setManualOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <BookOpen className="h-4 w-4 text-slate-400" aria-hidden />
                  {t.header.manual}
                </button>
                <div className="mt-2 px-3 py-1.5">
                  <LanguageToggle />
                </div>
              </nav>
              <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
                <p>{t.header.menuFooter}</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ── Body: sidebar + inhoud ─────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Desktop-sidebar: permanente navigatie met groepen — waar je bent
            en hoe je terugkomt is altijd zichtbaar. Automatisch inklapbaar:
            rail onder 1280px, vol erboven; handmatige keuze wordt bewaard. */}
        <aside
          className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 md:flex ${
            navFull ? 'w-60' : 'w-[52px]'
          }`}
        >
          <div className={`flex shrink-0 items-center border-b border-slate-100 ${navFull ? 'justify-end px-3 py-2' : 'justify-center py-2'}`}>
            <button
              onClick={toggleNav}
              aria-label={navFull ? t.header.navCollapse : t.header.navExpand}
              title={navFull ? t.header.navCollapse : t.header.navExpand}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              {navFull ? <PanelLeftClose className="h-4 w-4" aria-hidden /> : <PanelLeftOpen className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          {navFull ? (
            <>
              <nav aria-label={t.header.sections} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                <NavGroup label={t.nav.groupUse} ids={GROUP_USE} {...navGroupsProps} />
                <NavGroup label={t.nav.groupResearch} ids={GROUP_RESEARCH} {...navGroupsProps} />
                <NavGroup label={t.nav.groupMeta} ids={GROUP_META} {...navGroupsProps} />
              </nav>
              <div className="shrink-0 border-t border-slate-100 px-3 py-2.5">
                <button
                  onClick={() => setDisclaimerOpen(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <TriangleAlert className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                  {t.disclaimer.chip}
                </button>
              </div>
              <div className="shrink-0 border-t border-slate-100 px-4 py-3 text-[10.5px] leading-relaxed text-slate-400">
                <p>{t.header.footer1}</p>
                <p className="mt-1.5">{t.header.footer2}</p>
              </div>
            </>
          ) : (
            <>
              <nav aria-label={t.header.sections} className="min-h-0 flex-1 overflow-y-auto py-2">
                {[
                  { label: t.nav.groupUse, ids: GROUP_USE },
                  { label: t.nav.groupResearch, ids: GROUP_RESEARCH },
                  { label: t.nav.groupMeta, ids: GROUP_META },
                ].map((group) => (
                  <div key={group.label}>
                    {group.ids.map((id) => {
                      const s = sections.find((x) => x.id === id);
                      if (!s) return null;
                      const isActive = active === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => go(s.id)}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={s.label}
                          title={s.label}
                          className={`mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          <s.icon className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="shrink-0 border-t border-slate-100 py-2">
                <button
                  onClick={() => setDisclaimerOpen(true)}
                  aria-label={t.disclaimer.chip}
                  title={t.disclaimer.chip}
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
                >
                  <TriangleAlert className="h-[18px] w-[18px] shrink-0 text-rose-500" aria-hidden />
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Inhoud */}
        <main className="min-h-0 min-w-0 flex-1">
          {active === 'chat' ? (
            <div className="mx-auto h-full max-w-7xl px-3 pb-2 pt-2 md:px-4 md:py-6 md:pb-6">
              <ChatPanel onNavigate={go} />
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="mx-auto max-w-7xl px-3 py-4 md:px-4 md:py-6">
                {active === 'dashboard' && (
                  <DashboardPanel onNavigate={go} onOpenManual={() => setManualOpen(true)} />
                )}
                {active === 'verify' && <VerifyPanel />}
                {active === 'eval' && <EvalPanel />}
                {active === 'kg' && <KgPanel />}
                {active === 'hitl' && <HitlPanel />}
                {active === 'ledger' && <LedgerPanel />}
                {active === 'about' && <AboutPanel />}
                {active === 'steer' && <SteerPanel />}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Mobiele bottomnavigatie ────────────────────────── */}
      <nav
        className="shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label={t.header.primaryNav}
      >
        <div className="grid h-16 grid-cols-5">
          {([
            { id: 'dashboard' as const, label: t.nav.start, icon: LayoutDashboard },
            { id: 'chat' as const, label: t.nav.chat, icon: MessageSquareHeart },
            { id: 'verify' as const, label: t.nav.verify, icon: ShieldCheck },
            { id: 'hitl' as const, label: t.nav.hitl, icon: ClipboardCheck },
            { id: 'more' as const, label: t.nav.more, icon: Menu },
          ]).map((item) => {
            const isActive = item.id !== 'more' && active === item.id;
            const content = (
              <>
                <item.icon
                  className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-slate-400'}`}
                  aria-hidden
                />
                <span className={`text-[10px] leading-none ${isActive ? 'font-medium text-blue-900' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </>
            );
            if (item.id === 'more') {
              return (
                <button
                  key={item.id}
                  onClick={() => setMenuOpen(true)}
                  className="flex h-full flex-col items-center justify-center gap-1"
                  aria-label={t.header.moreSections}
                >
                  {content}
                </button>
              );
            }
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex h-full flex-col items-center justify-center gap-1"
              >
                {content}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Handleiding / onboarding */}
      <ManualDialog open={manualOpen} onOpenChange={handleManualChange} />
      {/* Disclaimer — canoniek, gestructureerd */}
      <DisclaimerDialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen} />
    </div>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <Shell />
    </LanguageProvider>
  );
}
