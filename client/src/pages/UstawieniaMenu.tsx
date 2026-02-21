import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  GripVertical,
  Plus,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
  Minus,
  Type,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Palette,
  MoveRight,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type NavItem,
  type NavSection,
  ICON_MAP,
  ICON_CATEGORIES,
  SECTION_COLORS,
  DEFAULT_ITEMS,
  DEFAULT_SECTIONS,
  getSectionColorClass,
  loadLayout,
  saveLayout,
  loadCustomLabels,
  saveCustomLabels,
  loadHiddenItems,
  saveHiddenItems,
  loadCustomItems,
  saveCustomItems,
  loadCollapsed,
  saveCollapsed,
  syncToServer,
  findSectionOfItem,
  generateId,
  STORAGE_KEY,
} from "@/lib/sidebar-config";
import { useToast } from "@/hooks/use-toast";

function SortableSettingsItem({
  itemId,
  item,
  isHidden,
  onToggleVisibility,
  onRemove,
  onMoveToSection,
  isCustom,
  sections,
  currentSectionId,
}: {
  itemId: string;
  item: NavItem | null;
  isHidden: boolean;
  onToggleVisibility: (id: string) => void;
  onRemove?: (id: string) => void;
  onMoveToSection?: (itemId: string, targetSectionId: string) => void;
  isCustom: boolean;
  sections?: NavSection[];
  currentSectionId?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSep = itemId.startsWith("sep-");
  const isLabel = itemId.startsWith("label-");

  if (isSep) {
    return (
      <div ref={setNodeRef} style={style} className={cn("flex items-center gap-2 py-1 group", isDragging && "opacity-50")}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 flex items-center gap-2">
          <Minus className="h-3 w-3 text-muted-foreground" />
          <div className="flex-1 border-t border-border" />
          <span className="text-[10px] text-muted-foreground">Separator</span>
        </div>
        {onRemove && (
          <button
            onClick={() => onRemove(itemId)}
            className="invisible group-hover:visible text-muted-foreground hover:text-destructive transition-colors"
            data-testid={`remove-${itemId}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (isLabel) {
    return (
      <div ref={setNodeRef} style={style} className={cn("flex items-center gap-2 py-1 group", isDragging && "opacity-50")}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Type className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground truncate">{item?.label || "Etykieta"}</span>
        </div>
        {onRemove && (
          <button
            onClick={() => onRemove(itemId)}
            className="invisible group-hover:visible text-muted-foreground hover:text-destructive transition-colors"
            data-testid={`remove-${itemId}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  const Icon = item ? ICON_MAP[item.iconName] : null;

  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center gap-2 py-1.5 group", isDragging && "opacity-50", isHidden && "opacity-40")}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className={cn("text-sm truncate", isHidden ? "line-through text-muted-foreground" : "text-foreground")}>{item?.label || itemId}</span>
      </div>
      {onMoveToSection && sections && sections.length > 1 && (
        <Select
          value=""
          onValueChange={(val) => onMoveToSection(itemId, val)}
        >
          <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent shadow-none [&>svg]:hidden" data-testid={`move-item-${itemId}`} title="Przenieś do sekcji">
            <MoveRight className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
          </SelectTrigger>
          <SelectContent>
            {sections.filter(s => s.id !== currentSectionId).map(s => (
              <SelectItem key={s.id} value={s.id} data-testid={`move-to-${s.id}`}>
                {s.title || "Główne"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <button
        onClick={() => onToggleVisibility(itemId)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        data-testid={`toggle-visibility-${itemId}`}
        title={isHidden ? "Pokaż" : "Ukryj"}
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {isCustom && onRemove && (
        <button
          onClick={() => onRemove(itemId)}
          className="invisible group-hover:visible text-muted-foreground hover:text-destructive transition-colors"
          data-testid={`remove-${itemId}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function DroppableSectionContainer({ sectionId, children }: { sectionId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `droppable-${sectionId}` });
  return (
    <div ref={setNodeRef} className={cn("min-h-[40px] rounded-lg transition-colors", isOver && "bg-accent/30")}>
      {children}
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Popularne");

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return ICON_CATEGORIES;
    const q = search.toLowerCase();
    return ICON_CATEGORIES.map(cat => ({
      ...cat,
      icons: cat.icons.filter(name => name.toLowerCase().includes(q)),
    })).filter(cat => cat.icons.length > 0);
  }, [search]);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Szukaj ikony..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="text-sm"
        data-testid="input-icon-search"
      />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filteredCategories.map(cat => (
          <div key={cat.label}>
            <button
              onClick={() => setExpandedCategory(expandedCategory === cat.label ? null : cat.label)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground w-full py-1 hover:text-foreground transition-colors"
            >
              {expandedCategory === cat.label ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {cat.label}
            </button>
            {expandedCategory === cat.label && (
              <div className="grid grid-cols-8 gap-1 py-1">
                {cat.icons.map(iconName => {
                  const Icon = ICON_MAP[iconName];
                  if (!Icon) return null;
                  return (
                    <button
                      key={iconName}
                      onClick={() => onChange(iconName)}
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                        value === iconName ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground"
                      )}
                      title={iconName}
                      data-testid={`icon-option-${iconName}`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UstawieniaMenu() {
  const { toast } = useToast();
  const [layout, setLayoutState] = useState(() => loadLayout());
  const [customLabels, setCustomLabelsState] = useState(() => loadCustomLabels());
  const [hiddenItems, setHiddenItemsState] = useState(() => loadHiddenItems());
  const [customItems, setCustomItemsState] = useState(() => loadCustomItems());
  const [collapsed, setCollapsedState] = useState(() => loadCollapsed());
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionIcon, setNewSectionIcon] = useState("Star");
  const [newSectionColor, setNewSectionColor] = useState("cyan");

  const [showAddLabel, setShowAddLabel] = useState<string | null>(null);
  const [newLabelText, setNewLabelText] = useState("");

  const allItems = useMemo(() => {
    return { ...layout.items, ...customItems };
  }, [layout.items, customItems]);

  const itemsWithLabels = useMemo(() => {
    const merged: Record<string, NavItem> = {};
    for (const [key, item] of Object.entries(allItems)) {
      merged[key] = customLabels[key] ? { ...item, label: customLabels[key] } : item;
    }
    return merged;
  }, [allItems, customLabels]);

  const persistAll = useCallback((sections: NavSection[], hidden: Set<string>, labels: Record<string, string>, items: Record<string, NavItem>) => {
    saveLayout(sections);
    saveHiddenItems(hidden);
    saveCustomLabels(labels);
    saveCustomItems(items);
    syncToServer(sections, collapsed, labels, hidden);
  }, [collapsed]);

  const toggleVisibility = useCallback((itemId: string) => {
    setHiddenItemsState(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      saveHiddenItems(next);
      syncToServer(layout.sections, collapsed, customLabels, next);
      return next;
    });
  }, [layout.sections, collapsed, customLabels]);

  const addSeparator = useCallback((sectionId: string) => {
    const sepId = generateId("sep");
    setLayoutState(prev => {
      const newSections = prev.sections.map(s => {
        if (s.id === sectionId) return { ...s, itemIds: [...s.itemIds, sepId] };
        return s;
      });
      saveLayout(newSections);
      syncToServer(newSections, collapsed, customLabels, hiddenItems);
      return { ...prev, sections: newSections };
    });
    toast({ title: "Dodano separator" });
  }, [collapsed, customLabels, hiddenItems]);

  const addLabel = useCallback((sectionId: string, text: string) => {
    const labelId = generateId("label");
    const newItem: NavItem = { id: labelId, href: "", label: text, iconName: "Type", type: "label" };
    setCustomItemsState(prev => {
      const next = { ...prev, [labelId]: newItem };
      saveCustomItems(next);
      return next;
    });
    setLayoutState(prev => {
      const newSections = prev.sections.map(s => {
        if (s.id === sectionId) return { ...s, itemIds: [...s.itemIds, labelId] };
        return s;
      });
      saveLayout(newSections);
      syncToServer(newSections, collapsed, customLabels, hiddenItems);
      return { ...prev, sections: newSections };
    });
    toast({ title: "Dodano etykietę" });
  }, [collapsed, customLabels, hiddenItems]);

  const addSection = useCallback(() => {
    if (!newSectionTitle.trim()) return;
    const sectionId = generateId("section");
    const newSection: NavSection = {
      id: sectionId,
      title: newSectionTitle.trim().toUpperCase(),
      itemIds: [],
      iconName: newSectionIcon,
      color: newSectionColor,
      isCustom: true,
    };
    setLayoutState(prev => {
      const newSections = [...prev.sections, newSection];
      saveLayout(newSections);
      syncToServer(newSections, collapsed, customLabels, hiddenItems);
      return { ...prev, sections: newSections };
    });
    setShowNewSection(false);
    setNewSectionTitle("");
    setNewSectionIcon("Star");
    setNewSectionColor("cyan");
    toast({ title: "Dodano sekcję" });
  }, [newSectionTitle, newSectionIcon, newSectionColor, collapsed, customLabels, hiddenItems]);

  const removeSection = useCallback((sectionId: string) => {
    setLayoutState(prev => {
      const section = prev.sections.find(s => s.id === sectionId);
      if (!section) return prev;
      const lastDefault = prev.sections.filter(s => !s.isCustom).pop();
      const newSections = prev.sections.filter(s => s.id !== sectionId).map(s => {
        if (lastDefault && s.id === lastDefault.id) {
          const defaultItemIds = section.itemIds.filter(id => DEFAULT_ITEMS[id]);
          return { ...s, itemIds: [...s.itemIds, ...defaultItemIds] };
        }
        return s;
      });
      const customItemsToRemove = section.itemIds.filter(id => id.startsWith("sep-") || id.startsWith("label-"));
      if (customItemsToRemove.length > 0) {
        setCustomItemsState(prevItems => {
          const next = { ...prevItems };
          customItemsToRemove.forEach(id => delete next[id]);
          saveCustomItems(next);
          return next;
        });
      }
      saveLayout(newSections);
      syncToServer(newSections, collapsed, customLabels, hiddenItems);
      return { ...prev, sections: newSections };
    });
    toast({ title: "Usunięto sekcję" });
  }, [collapsed, customLabels, hiddenItems]);

  const removeItem = useCallback((itemId: string) => {
    setLayoutState(prev => {
      const newSections = prev.sections.map(s => ({
        ...s,
        itemIds: s.itemIds.filter(id => id !== itemId),
      }));
      saveLayout(newSections);
      syncToServer(newSections, collapsed, customLabels, hiddenItems);
      return { ...prev, sections: newSections };
    });
    if (itemId.startsWith("label-") || itemId.startsWith("sep-")) {
      setCustomItemsState(prev => {
        const next = { ...prev };
        delete next[itemId];
        saveCustomItems(next);
        return next;
      });
    }
  }, [collapsed, customLabels, hiddenItems]);

  const moveSection = useCallback((sectionId: string, direction: "up" | "down") => {
    setLayoutState(prev => {
      const idx = prev.sections.findIndex(s => s.id === sectionId);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.sections.length) return prev;
      const newSections = [...prev.sections];
      [newSections[idx], newSections[targetIdx]] = [newSections[targetIdx], newSections[idx]];
      saveLayout(newSections);
      syncToServer(newSections, collapsed, customLabels, hiddenItems);
      return { ...prev, sections: newSections };
    });
  }, [collapsed, customLabels, hiddenItems]);

  const moveItemToSection = useCallback((itemId: string, targetSectionId: string) => {
    setLayoutState(prev => {
      const currentSection = findSectionOfItem(prev.sections, itemId);
      if (!currentSection || currentSection === targetSectionId) return prev;
      const newSections = prev.sections.map(s => {
        if (s.id === currentSection) return { ...s, itemIds: s.itemIds.filter(id => id !== itemId) };
        if (s.id === targetSectionId) return { ...s, itemIds: [...s.itemIds, itemId] };
        return s;
      });
      saveLayout(newSections);
      syncToServer(newSections, collapsed, customLabels, hiddenItems);
      return { ...prev, sections: newSections };
    });
    toast({ title: "Przeniesiono element" });
  }, [collapsed, customLabels, hiddenItems]);

  const resetToDefault = useCallback(() => {
    const defaultSections = DEFAULT_SECTIONS.map(s => ({ ...s }));
    setLayoutState({ sections: defaultSections, items: { ...DEFAULT_ITEMS } });
    setCustomLabelsState({});
    setHiddenItemsState(new Set());
    setCustomItemsState({});
    setCollapsedState(new Set());
    saveLayout(defaultSections);
    saveCustomLabels({});
    saveHiddenItems(new Set());
    saveCustomItems({});
    saveCollapsed(new Set());
    syncToServer(defaultSections, new Set(), {}, new Set());
    toast({ title: "Przywrócono domyślne ustawienia menu" });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const resolveDropSection = useCallback((overId: string): string | null => {
    if (overId.startsWith("droppable-")) {
      return overId.replace("droppable-", "");
    }
    const section = findSectionOfItem(layout.sections, overId);
    if (section) return section;
    return layout.sections.find(s => s.id === overId)?.id || null;
  }, [layout.sections]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    const activeSection = findSectionOfItem(layout.sections, activeItemId);
    const overSection = resolveDropSection(overId);

    if (!activeSection || !overSection || activeSection === overSection) return;

    setLayoutState(prev => {
      const newSections = prev.sections.map(s => ({ ...s, itemIds: [...s.itemIds] }));
      const fromSection = newSections.find(s => s.id === activeSection)!;
      const toSection = newSections.find(s => s.id === overSection)!;

      fromSection.itemIds = fromSection.itemIds.filter(id => id !== activeItemId);
      const overIndex = toSection.itemIds.indexOf(overId);
      if (overIndex >= 0) {
        toSection.itemIds.splice(overIndex, 0, activeItemId);
      } else {
        toSection.itemIds.push(activeItemId);
      }

      return { ...prev, sections: newSections };
    });
  }, [layout.sections, resolveDropSection]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    const activeSection = findSectionOfItem(layout.sections, activeItemId);
    const overSection = resolveDropSection(overId);

    if (activeSection && overSection && activeSection === overSection) {
      const section = layout.sections.find(s => s.id === activeSection)!;
      const oldIndex = section.itemIds.indexOf(activeItemId);
      const newIndex = section.itemIds.indexOf(overId);

      if (oldIndex !== newIndex) {
        setLayoutState(prev => {
          const newSections = prev.sections.map(s => {
            if (s.id === activeSection) {
              return { ...s, itemIds: arrayMove(s.itemIds, oldIndex, newIndex) };
            }
            return s;
          });
          saveLayout(newSections);
          syncToServer(newSections, collapsed, customLabels, hiddenItems);
          return { ...prev, sections: newSections };
        });
        return;
      }
    }

    setLayoutState(prev => {
      saveLayout(prev.sections);
      syncToServer(prev.sections, collapsed, customLabels, hiddenItems);
      return prev;
    });
  }, [layout.sections, collapsed, customLabels, hiddenItems]);

  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const centerCollisions = closestCenter(args);
    if (centerCollisions.length > 0) return centerCollisions;
    return pointerWithin(args);
  }, []);

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return itemsWithLabels[activeId as string] || null;
  }, [activeId, itemsWithLabels]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Personalizacja menu</h1>
          <p className="text-sm text-muted-foreground mt-1">Dostosuj układ menu bocznego — zmieniaj kolejność sekcji strzałkami, przenoś strony między sekcjami, ukrywaj niepotrzebne elementy</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewSection(true)}
            data-testid="button-add-section"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nowa sekcja
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefault}
            data-testid="button-reset-menu"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {layout.sections.map((section, sIdx) => {
            const SectionIcon = section.iconName ? ICON_MAP[section.iconName] : null;
            return (
              <Card key={section.id} data-testid={`settings-section-${section.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveSection(section.id, "up")}
                          disabled={sIdx === 0}
                          className={cn("p-0.5 rounded transition-colors", sIdx === 0 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
                          data-testid={`move-section-up-${section.id}`}
                          title="Przesuń sekcję w górę"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveSection(section.id, "down")}
                          disabled={sIdx === layout.sections.length - 1}
                          className={cn("p-0.5 rounded transition-colors", sIdx === layout.sections.length - 1 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
                          data-testid={`move-section-down-${section.id}`}
                          title="Przesuń sekcję w dół"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                      {SectionIcon && <SectionIcon className={cn("h-4 w-4", getSectionColorClass(section.color))} />}
                      <CardTitle className={cn("text-sm font-bold uppercase tracking-wider", getSectionColorClass(section.color))}>
                        {section.title || "Główne"}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addSeparator(section.id)}
                        className="h-7 px-2 text-xs"
                        data-testid={`add-separator-${section.id}`}
                      >
                        <Minus className="h-3 w-3 mr-1" />
                        Separator
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowAddLabel(section.id); setNewLabelText(""); }}
                        className="h-7 px-2 text-xs"
                        data-testid={`add-label-${section.id}`}
                      >
                        <Type className="h-3 w-3 mr-1" />
                        Etykieta
                      </Button>
                      {section.isCustom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSection(section.id)}
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          data-testid={`remove-section-${section.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <DroppableSectionContainer sectionId={section.id}>
                  <SortableContext items={section.itemIds} strategy={verticalListSortingStrategy} id={section.id}>
                    {section.itemIds.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                        Przeciągnij elementy tutaj
                      </div>
                    ) : (
                      section.itemIds.map(itemId => (
                        <SortableSettingsItem
                          key={itemId}
                          itemId={itemId}
                          item={itemsWithLabels[itemId] || null}
                          isHidden={hiddenItems.has(itemId)}
                          onToggleVisibility={toggleVisibility}
                          onRemove={removeItem}
                          onMoveToSection={!itemId.startsWith("sep-") && !itemId.startsWith("label-") ? moveItemToSection : undefined}
                          isCustom={itemId.startsWith("sep-") || itemId.startsWith("label-")}
                          sections={layout.sections}
                          currentSectionId={section.id}
                        />
                      ))
                    )}
                  </SortableContext>
                  </DroppableSectionContainer>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              {activeItem.iconName && ICON_MAP[activeItem.iconName] && (
                (() => { const I = ICON_MAP[activeItem.iconName]; return <I className="h-4 w-4 text-muted-foreground" />; })()
              )}
              <span className="text-sm">{activeItem.label}</span>
            </div>
          ) : activeId && String(activeId).startsWith("sep-") ? (
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Minus className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Separator</span>
            </div>
          ) : activeId && String(activeId).startsWith("label-") ? (
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Type className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Etykieta</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={showNewSection} onOpenChange={setShowNewSection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa sekcja menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nazwa sekcji</label>
              <Input
                placeholder="np. MOJE NARZĘDZIA"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                data-testid="input-section-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Kolor</label>
              <div className="flex flex-wrap gap-2">
                {SECTION_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setNewSectionColor(c.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                      newSectionColor === c.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    )}
                    data-testid={`color-option-${c.value}`}
                  >
                    <div className={cn("w-3 h-3 rounded-full", c.className.replace("text-", "bg-"))} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ikona</label>
              <IconPicker value={newSectionIcon} onChange={setNewSectionIcon} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSection(false)}>Anuluj</Button>
            <Button onClick={addSection} disabled={!newSectionTitle.trim()} data-testid="button-confirm-add-section">
              Dodaj sekcję
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddLabel !== null} onOpenChange={(open) => !open && setShowAddLabel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dodaj etykietę</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <Input
              placeholder="Tekst etykiety..."
              value={newLabelText}
              onChange={(e) => setNewLabelText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabelText.trim() && showAddLabel) {
                  addLabel(showAddLabel, newLabelText.trim());
                  setShowAddLabel(null);
                }
              }}
              data-testid="input-label-text"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLabel(null)}>Anuluj</Button>
            <Button
              onClick={() => {
                if (newLabelText.trim() && showAddLabel) {
                  addLabel(showAddLabel, newLabelText.trim());
                  setShowAddLabel(null);
                }
              }}
              disabled={!newLabelText.trim()}
              data-testid="button-confirm-add-label"
            >
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
