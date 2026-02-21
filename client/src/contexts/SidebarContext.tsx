import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  type SidebarConfig,
  type NavItem,
  type NavSection,
  DEFAULT_CONFIG,
  DEFAULT_ITEMS,
  loadConfigFromStorage,
  saveConfigToStorage,
  reconcileConfig,
  parseServerConfig,
  serializeForServer,
  generateId,
} from "@/lib/sidebar-config";

interface SidebarContextValue {
  config: SidebarConfig;
  allItems: Record<string, NavItem>;
  updateConfig: (updater: (prev: SidebarConfig) => SidebarConfig) => void;
  setSections: (sections: NavSection[]) => void;
  toggleHidden: (itemId: string) => void;
  setCustomLabel: (itemId: string, label: string) => void;
  removeCustomLabel: (itemId: string) => void;
  toggleCollapsed: (sectionId: string) => void;
  setCompact: (compact: boolean) => void;
  setBadgeConfig: (config: Record<string, boolean>) => void;
  addSection: (title: string, iconName: string, color: string) => void;
  removeSection: (sectionId: string) => void;
  addSeparator: (sectionId: string) => void;
  addLabel: (sectionId: string, text: string) => void;
  removeItem: (itemId: string) => void;
  moveItemToSection: (itemId: string, fromSectionId: string, toSectionId: string) => void;
  applyPreset: (sections: NavSection[], hiddenItems?: string[]) => void;
  resetToDefault: () => void;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SidebarConfig>(() => {
    const stored = loadConfigFromStorage();
    if (stored) return reconcileConfig(stored);
    return { ...DEFAULT_CONFIG, sections: DEFAULT_CONFIG.sections.map(s => ({ ...s, itemIds: [...s.itemIds] })) };
  });

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServerTimestamp = useRef<string | null>(null);
  const skipNextServerSync = useRef(false);

  const { data: serverPrefs } = useQuery<any>({
    queryKey: ["/api/user-preferences"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!serverPrefs) return;
    const ts = serverPrefs.updatedAt || "";
    if (lastServerTimestamp.current === ts) return;
    lastServerTimestamp.current = ts;

    if (skipNextServerSync.current) {
      skipNextServerSync.current = false;
      return;
    }

    const parsed = parseServerConfig(serverPrefs);
    if (parsed) {
      setConfig(parsed);
      saveConfigToStorage(parsed);
    }
  }, [serverPrefs]);

  const syncToServer = useCallback((cfg: SidebarConfig) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        skipNextServerSync.current = true;
        await apiRequest("PUT", "/api/user-preferences", {
          sidebarLayout: serializeForServer(cfg),
        });
      } catch {}
    }, 800);
  }, []);

  const persist = useCallback((cfg: SidebarConfig) => {
    saveConfigToStorage(cfg);
    syncToServer(cfg);
  }, [syncToServer]);

  const updateConfig = useCallback((updater: (prev: SidebarConfig) => SidebarConfig) => {
    setConfig(prev => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const setSections = useCallback((sections: NavSection[]) => {
    updateConfig(prev => ({ ...prev, sections }));
  }, [updateConfig]);

  const toggleHidden = useCallback((itemId: string) => {
    updateConfig(prev => {
      const set = new Set(prev.hiddenItems);
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      return { ...prev, hiddenItems: [...set] };
    });
  }, [updateConfig]);

  const setCustomLabel = useCallback((itemId: string, label: string) => {
    updateConfig(prev => ({
      ...prev,
      customLabels: { ...prev.customLabels, [itemId]: label },
    }));
  }, [updateConfig]);

  const removeCustomLabel = useCallback((itemId: string) => {
    updateConfig(prev => {
      const next = { ...prev.customLabels };
      delete next[itemId];
      return { ...prev, customLabels: next };
    });
  }, [updateConfig]);

  const toggleCollapsed = useCallback((sectionId: string) => {
    updateConfig(prev => {
      const set = new Set(prev.collapsed);
      if (set.has(sectionId)) set.delete(sectionId);
      else set.add(sectionId);
      return { ...prev, collapsed: [...set] };
    });
  }, [updateConfig]);

  const setCompact = useCallback((compact: boolean) => {
    updateConfig(prev => ({ ...prev, compact }));
  }, [updateConfig]);

  const setBadgeConfig = useCallback((badgeConfig: Record<string, boolean>) => {
    updateConfig(prev => ({ ...prev, badgeConfig }));
  }, [updateConfig]);

  const addSection = useCallback((title: string, iconName: string, color: string) => {
    const sectionId = generateId("section");
    const newSection: NavSection = {
      id: sectionId,
      title: title.toUpperCase(),
      itemIds: [],
      iconName,
      color,
      isCustom: true,
    };
    updateConfig(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  }, [updateConfig]);

  const removeSection = useCallback((sectionId: string) => {
    updateConfig(prev => {
      const section = prev.sections.find(s => s.id === sectionId);
      if (!section || !section.isCustom) return prev;
      const orphanedItems = section.itemIds;
      const remaining = prev.sections.filter(s => s.id !== sectionId).map(s => ({ ...s, itemIds: [...s.itemIds] }));
      if (orphanedItems.length > 0 && remaining.length > 0) {
        const target = remaining.find(s => !s.isCustom) || remaining[remaining.length - 1];
        target.itemIds.push(...orphanedItems);
      }
      const newCustomItems = { ...prev.customItems };
      for (const id of orphanedItems) {
        if (id.startsWith("sep-") || id.startsWith("label-")) {
          delete newCustomItems[id];
        }
      }
      return { ...prev, sections: remaining, customItems: newCustomItems };
    });
  }, [updateConfig]);

  const addSeparator = useCallback((sectionId: string) => {
    const sepId = generateId("sep");
    updateConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, itemIds: [...s.itemIds, sepId] } : s
      ),
    }));
  }, [updateConfig]);

  const addLabel = useCallback((sectionId: string, text: string) => {
    const labelId = generateId("label");
    const newItem: NavItem = { id: labelId, href: "", label: text, iconName: "Type", type: "label" };
    updateConfig(prev => ({
      ...prev,
      customItems: { ...prev.customItems, [labelId]: newItem },
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, itemIds: [...s.itemIds, labelId] } : s
      ),
    }));
  }, [updateConfig]);

  const removeItem = useCallback((itemId: string) => {
    updateConfig(prev => {
      const newCustomItems = { ...prev.customItems };
      delete newCustomItems[itemId];
      return {
        ...prev,
        customItems: newCustomItems,
        sections: prev.sections.map(s => ({
          ...s,
          itemIds: s.itemIds.filter(id => id !== itemId),
        })),
      };
    });
  }, [updateConfig]);

  const moveItemToSection = useCallback((itemId: string, fromSectionId: string, toSectionId: string) => {
    updateConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id === fromSectionId) return { ...s, itemIds: s.itemIds.filter(id => id !== itemId) };
        if (s.id === toSectionId) return { ...s, itemIds: [...s.itemIds, itemId] };
        return s;
      }),
    }));
  }, [updateConfig]);

  const applyPreset = useCallback((sections: NavSection[], hiddenItems?: string[]) => {
    updateConfig(prev => ({
      ...prev,
      sections: sections.map(s => ({ ...s, itemIds: [...s.itemIds] })),
      hiddenItems: hiddenItems || [],
      customItems: {},
      customLabels: {},
    }));
  }, [updateConfig]);

  const resetToDefault = useCallback(() => {
    const fresh = {
      ...DEFAULT_CONFIG,
      sections: DEFAULT_CONFIG.sections.map(s => ({ ...s, itemIds: [...s.itemIds] })),
    };
    setConfig(fresh);
    persist(fresh);
  }, [persist]);

  const exportConfig = useCallback(() => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  const importConfig = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed?.sections) return false;
      const reconciled = reconcileConfig(parsed);
      setConfig(reconciled);
      persist(reconciled);
      return true;
    } catch {
      return false;
    }
  }, [persist]);

  const allItems: Record<string, NavItem> = { ...DEFAULT_ITEMS, ...config.customItems };
  for (const [key, label] of Object.entries(config.customLabels)) {
    if (allItems[key]) {
      allItems[key] = { ...allItems[key], label };
    }
  }

  return (
    <SidebarContext.Provider value={{
      config,
      allItems,
      updateConfig,
      setSections,
      toggleHidden,
      setCustomLabel,
      removeCustomLabel,
      toggleCollapsed,
      setCompact,
      setBadgeConfig,
      addSection,
      removeSection,
      addSeparator,
      addLabel,
      removeItem,
      moveItemToSection,
      applyPreset,
      resetToDefault,
      exportConfig,
      importConfig,
    }}>
      {children}
    </SidebarContext.Provider>
  );
}
