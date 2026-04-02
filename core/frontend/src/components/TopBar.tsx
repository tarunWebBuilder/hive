import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Moon, Sun, X } from "lucide-react";
import { sessionsApi } from "@/api/sessions";
import { loadPersistedTabs, savePersistedTabs, TAB_STORAGE_KEY, type PersistedTabState } from "@/lib/tab-persistence";

export interface TopBarTab {
  agentType: string;
  label: string;
  isActive: boolean;
  hasRunning: boolean;
}

interface TopBarProps {
  /** Live tabs from workspace state. When omitted, reads from localStorage. */
  tabs?: TopBarTab[];
  /** Called when a tab is clicked (workspace overrides to setActiveWorker). */
  onTabClick?: (agentType: string) => void;
  /** Called when a tab's X is clicked (workspace overrides for SSE teardown). */
  onCloseTab?: (agentType: string) => void;
  /** Whether close buttons are shown. Defaults to true when >1 tab. */
  canCloseTabs?: boolean;
  /** Content rendered right after the tab strip (e.g. + button). */
  afterTabs?: React.ReactNode;
  /** Right-side slot for page-specific controls (e.g. credentials). */
  children?: React.ReactNode;
}

export default function TopBar({ tabs: tabsProp, onTabClick, onCloseTab, canCloseTabs, afterTabs, children }: TopBarProps) {
  const navigate = useNavigate();
  const THEME_KEY = "hive.theme";
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  // Fallback: read persisted tabs when no live tabs provided
  const [persisted, setPersisted] = useState<PersistedTabState | null>(() =>
    tabsProp ? null : loadPersistedTabs()
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const tabs: TopBarTab[] = tabsProp ?? deriveTabs(persisted);
  const showClose = canCloseTabs ?? true;

  const handleTabClick = useCallback((agentType: string) => {
    if (onTabClick) {
      onTabClick(agentType);
    } else {
      navigate(`/workspace?agent=${encodeURIComponent(agentType)}`);
    }
  }, [onTabClick, navigate]);

  const handleCloseTab = useCallback((agentType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCloseTab) {
      onCloseTab(agentType);
      return;
    }
    // Kill the backend session (queen/worker) even outside workspace
    sessionsApi.list()
      .then(({ sessions }) => {
        const match = sessions.find(s => s.agent_path.endsWith(agentType));
        if (match) return sessionsApi.stop(match.session_id);
      })
      .catch(() => {});  // fire-and-forget

    // Fallback: update localStorage directly (non-workspace pages)
    setPersisted(prev => {
      if (!prev) return null;
      const nextTabs = prev.tabs.filter(t => t.agentType !== agentType);
      if (nextTabs.length === 0) {
        localStorage.removeItem(TAB_STORAGE_KEY);
        return null;
      }
      const removedIds = new Set(prev.tabs.filter(t => t.agentType === agentType).map(t => t.id));
      const nextSessions = { ...prev.sessions };
      for (const id of removedIds) delete nextSessions[id];
      const nextActiveSession = { ...prev.activeSessionByAgent };
      delete nextActiveSession[agentType];
      const nextActiveWorker = prev.activeWorker === agentType
        ? nextTabs[0].agentType
        : prev.activeWorker;
      const nextState: PersistedTabState = {
        tabs: nextTabs,
        activeSessionByAgent: nextActiveSession,
        activeWorker: nextActiveWorker,
        sessions: nextSessions,
      };
      savePersistedTabs(nextState);
      return nextState;
    });
  }, [onCloseTab]);

  return (
    <div className="relative mx-3 mt-3 h-14 flex items-center justify-between px-4 rounded-2xl border border-primary/35 bg-card/90 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex-shrink-0">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-primary" />

      <div className="flex items-center gap-3 min-w-0 pl-2">
        <button
          onClick={() => navigate("/")}
          className="group flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-primary/10 flex-shrink-0"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
            <Crown className="w-4 h-4" />
          </span>
          <span className="flex flex-col items-start leading-none">
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Hive Navbar</span>
            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Open Hive</span>
          </span>
        </button>

        {tabs.length > 0 && (
          <>
            <span className="h-6 w-px bg-border/70 flex-shrink-0" />
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.agentType}
                  onClick={() => handleTabClick(tab.agentType)}
                  className={`group flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 border ${
                    tab.isActive
                      ? "bg-primary/15 text-foreground border-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/60 hover:border-border/60"
                  }`}
                >
                  {tab.hasRunning && (
                    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                    </span>
                  )}
                  <span>{tab.label}</span>
                  {showClose && (
                    <X
                      className="w-3 h-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                      onClick={(e) => handleCloseTab(tab.agentType, e)}
                    />
                  )}
                </button>
              ))}
            </div>
            {afterTabs}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {children && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {children}
          </div>
        )}
        <button
          type="button"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary/15 hover:border-primary/40"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** Derive TopBarTab[] from persisted localStorage state (used outside workspace). */
function deriveTabs(persisted: PersistedTabState | null): TopBarTab[] {
  if (!persisted) return [];
  const seen = new Set<string>();
  const tabs: TopBarTab[] = [];
  for (const tab of persisted.tabs) {
    if (seen.has(tab.agentType)) continue;
    seen.add(tab.agentType);
    const sessionData = persisted.sessions?.[tab.id];
    const hasRunning = sessionData?.graphNodes?.some(
      (n) => n.status === "running" || n.status === "looping"
    ) ?? false;
    tabs.push({
      agentType: tab.agentType,
      label: tab.label,
      isActive: false, // no active tab outside workspace
      hasRunning,
    });
  }
  return tabs;
}
