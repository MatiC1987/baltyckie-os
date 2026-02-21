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
  DialogDescription,
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
  MoveRight,
  Download,
  Upload,
  Save,
  LayoutTemplate,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
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
  getSectionColorClass,
  PRESET_LAYOUTS,
} from "@/lib/sidebar-config";
import { useSidebar } from "@/contexts/SidebarContext";
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
          <button onClick={() => onRemove(itemId)} className="invisible group-hover:visible text-muted-foreground hover:text-destructive transition-colors" data-testid={`remove-${itemId}`}>
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
          <button onClick={() => onRemove(itemId)} className="invisible group-hover:visible text-muted-foreground hover:text-destructive transition-colors" data-testid={`remove-${itemId}`}>
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
        <Select value="" onValueChange={(val) => onMoveToSection(itemId, val)}>
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
        <button onClick={() => onRemove(itemId)} className="invisible group-hover:visible text-muted-foreground hover:text-destructive transition-colors" data-testid={`remove-${itemId}`}>
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
      <Input placeholder="Szukaj ikony..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-sm" data-testid="input-icon-search" />
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

export default function MenuCustomizationPanel() {
  const { toast } = useToast();
  const {
    config, allItems, updateConfig, toggleHidden,
    addSection: ctxAddSection, removeSection, addSeparator, addLabel: ctxAddLabel,
    removeItem, moveItemToSection, applyPreset, resetToDefault,
    exportConfig, importConfig, setCompact: ctxSetCompact, setBadgeConfig: ctxSetBadgeConfig,
  } = useSidebar();

  const { sections, hiddenItems, compact, badgeConfig, customItems } = config;
  const hiddenSet = useMemo(() => new Set(hiddenItems), [hiddenItems]);

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionIcon, setNewSectionIcon] = useState("Star");
  const [newSectionColor, setNewSectionColor] = useState("cyan");
  const [showAddLabel, setShowAddLabel] = useState<string | null>(null);
  const [newLabelText, setNewLabelText] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(sections.map(s => s.id)));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findSectionOfItem = useCallback((itemId: string): string | null => {
    for (const section of sections) {
      if (section.itemIds.includes(itemId as string)) return section.id;
    }
    return null;
  }, [sections]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeSection = findSectionOfItem(activeId);
    let overSection: string | null = null;

    if (overId.startsWith("droppable-")) {
      overSection = overId.replace("droppable-", "");
    } else {
      overSection = findSectionOfItem(overId);
    }

    if (!activeSection || !overSection || activeSection === overSection) return;

    updateConfig(prev => {
      const newSections = prev.sections.map(s => {
        if (s.id === activeSection) {
          return { ...s, itemIds: s.itemIds.filter(id => id !== activeId) };
        }
        if (s.id === overSection) {
          const overIndex = s.itemIds.indexOf(overId);
          const newIds = [...s.itemIds];
          if (overIndex >= 0) {
            newIds.splice(overIndex, 0, activeId);
          } else {
            newIds.push(activeId);
          }
          return { ...s, itemIds: newIds };
        }
        return s;
      });
      return { ...prev, sections: newSections };
    });
  }, [findSectionOfItem, updateConfig]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    let overSectionId: string | null = null;
    if (overId.startsWith("droppable-")) {
      overSectionId = overId.replace("droppable-", "");
    } else {
      overSectionId = findSectionOfItem(overId);
    }

    const activeSectionId = findSectionOfItem(activeId);
    if (!activeSectionId) return;

    if (activeSectionId === overSectionId) {
      updateConfig(prev => {
        const newSections = prev.sections.map(s => {
          if (s.id !== activeSectionId) return s;
          const oldIndex = s.itemIds.indexOf(activeId);
          const newIndex = s.itemIds.indexOf(overId);
          if (oldIndex < 0 || newIndex < 0) return s;
          return { ...s, itemIds: arrayMove(s.itemIds, oldIndex, newIndex) };
        });
        return { ...prev, sections: newSections };
      });
    }
  }, [findSectionOfItem, updateConfig]);

  const handleMoveToSection = useCallback((itemId: string, targetSectionId: string) => {
    const fromSection = findSectionOfItem(itemId);
    if (fromSection) {
      moveItemToSection(itemId, fromSection, targetSectionId);
      toast({ title: "Przeniesiono element" });
    }
  }, [findSectionOfItem, moveItemToSection, toast]);

  const handleAddSection = useCallback(() => {
    if (!newSectionTitle.trim()) return;
    ctxAddSection(newSectionTitle.trim(), newSectionIcon, newSectionColor);
    setShowNewSection(false);
    setNewSectionTitle("");
    setNewSectionIcon("Star");
    setNewSectionColor("cyan");
    toast({ title: "Dodano nową sekcję" });
  }, [newSectionTitle, newSectionIcon, newSectionColor, ctxAddSection, toast]);

  const handleAddLabel = useCallback(() => {
    if (!showAddLabel || !newLabelText.trim()) return;
    ctxAddLabel(showAddLabel, newLabelText.trim());
    setShowAddLabel(null);
    setNewLabelText("");
    toast({ title: "Dodano etykietę" });
  }, [showAddLabel, newLabelText, ctxAddLabel, toast]);

  const handleRemoveSection = useCallback((sectionId: string) => {
    removeSection(sectionId);
    toast({ title: "Usunięto sekcję" });
  }, [removeSection, toast]);

  const handleRemoveItem = useCallback((itemId: string) => {
    removeItem(itemId);
    toast({ title: "Usunięto element" });
  }, [removeItem, toast]);

  const handleApplyPreset = useCallback((presetId: string) => {
    const preset = PRESET_LAYOUTS.find(p => p.id === presetId);
    if (!preset) return;
    applyPreset(preset.sections, preset.hiddenItems);
    setShowPresets(false);
    toast({ title: `Zastosowano preset: ${preset.label}` });
  }, [applyPreset, toast]);

  const handleReset = useCallback(() => {
    resetToDefault();
    toast({ title: "Przywrócono domyślne ustawienia" });
  }, [resetToDefault, toast]);

  const handleExport = useCallback(() => {
    const json = exportConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sidebar-config.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Wyeksportowano konfigurację" });
  }, [exportConfig, toast]);

  const handleImport = useCallback(() => {
    if (importConfig(importJson)) {
      setShowImport(false);
      setImportJson("");
      toast({ title: "Zaimportowano konfigurację" });
    } else {
      toast({ title: "Błąd importu", description: "Nieprawidłowy format danych", variant: "destructive" });
    }
  }, [importJson, importConfig, toast]);

  const handleMoveSectionUp = useCallback((sectionId: string) => {
    updateConfig(prev => {
      const idx = prev.sections.findIndex(s => s.id === sectionId);
      if (idx <= 0) return prev;
      return { ...prev, sections: arrayMove(prev.sections, idx, idx - 1) };
    });
  }, [updateConfig]);

  const handleMoveSectionDown = useCallback((sectionId: string) => {
    updateConfig(prev => {
      const idx = prev.sections.findIndex(s => s.id === sectionId);
      if (idx < 0 || idx >= prev.sections.length - 1) return prev;
      return { ...prev, sections: arrayMove(prev.sections, idx, idx + 1) };
    });
  }, [updateConfig]);

  const toggleExpandSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const activeItem = activeId ? allItems[activeId as string] : null;

  return (
    <div className="space-y-6" data-testid="menu-customization-panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold" data-testid="text-panel-title">Personalizacja menu</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowPresets(true)} data-testid="button-presets">
            <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
            Presety
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Eksport
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} data-testid="button-import">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tryb kompaktowy</span>
          <Switch checked={compact} onCheckedChange={ctxSetCompact} data-testid="switch-compact-mode" />
        </div>
      </div>

      <Card data-testid="card-badge-config">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Odznaki powiadomień</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          {[
            { id: "koszty", label: "Koszty — zaległe płatności" },
            { id: "apartment-schedule", label: "Harmonogram — zaległe płatności" },
            { id: "podnajem", label: "Podnajem — zaległe płatności" },
          ].map(badge => (
            <div key={badge.id} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{badge.label}</span>
              <Switch
                checked={badgeConfig[badge.id] !== false}
                onCheckedChange={(checked) => ctxSetBadgeConfig({ ...badgeConfig, [badge.id]: checked })}
                data-testid={`switch-badge-${badge.id}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-3">
          {sections.map((section, sIdx) => {
            const isExpanded = expandedSections.has(section.id);
            return (
              <Card key={section.id} data-testid={`settings-section-${section.id}`}>
                <CardHeader className="py-2 px-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleExpandSection(section.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      data-testid={`expand-section-${section.id}`}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className={cn("text-sm font-semibold", getSectionColorClass(section.color))}>
                        {section.title || "GŁÓWNE"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">({section.itemIds.length})</span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {sIdx > 0 && (
                        <button onClick={() => handleMoveSectionUp(section.id)} className="text-muted-foreground hover:text-foreground p-1" title="W górę" data-testid={`move-up-${section.id}`}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {sIdx < sections.length - 1 && (
                        <button onClick={() => handleMoveSectionDown(section.id)} className="text-muted-foreground hover:text-foreground p-1" title="W dół" data-testid={`move-down-${section.id}`}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => addSeparator(section.id)} className="text-muted-foreground hover:text-foreground p-1" title="Dodaj separator" data-testid={`add-sep-${section.id}`}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setShowAddLabel(section.id); setNewLabelText(""); }} className="text-muted-foreground hover:text-foreground p-1" title="Dodaj etykietę" data-testid={`add-label-${section.id}`}>
                        <Type className="h-3.5 w-3.5" />
                      </button>
                      {section.isCustom && (
                        <button onClick={() => handleRemoveSection(section.id)} className="text-muted-foreground hover:text-destructive p-1" title="Usuń sekcję" data-testid={`remove-section-${section.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="px-4 pb-3 pt-0">
                    <DroppableSectionContainer sectionId={section.id}>
                      <SortableContext items={section.itemIds} strategy={verticalListSortingStrategy}>
                        {section.itemIds.length === 0 ? (
                          <div className="py-4 text-center text-xs text-muted-foreground">
                            Przeciągnij elementy tutaj
                          </div>
                        ) : (
                          section.itemIds.map(itemId => (
                            <SortableSettingsItem
                              key={itemId}
                              itemId={itemId}
                              item={allItems[itemId] || null}
                              isHidden={hiddenSet.has(itemId)}
                              onToggleVisibility={toggleHidden}
                              onRemove={(itemId.startsWith("sep-") || itemId.startsWith("label-") || customItems[itemId]) ? handleRemoveItem : undefined}
                              onMoveToSection={handleMoveToSection}
                              isCustom={!DEFAULT_ITEMS[itemId]}
                              sections={sections}
                              currentSectionId={section.id}
                            />
                          ))
                        )}
                      </SortableContext>
                    </DroppableSectionContainer>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <DragOverlay>
          {activeId && activeItem ? (
            <div className="flex items-center gap-2 py-1.5 px-2 bg-background border rounded-lg shadow-lg">
              {ICON_MAP[activeItem.iconName] && (() => { const I = ICON_MAP[activeItem.iconName]; return <I className="h-4 w-4 text-muted-foreground" />; })()}
              <span className="text-sm">{activeItem.label}</span>
            </div>
          ) : activeId && (activeId as string).startsWith("sep-") ? (
            <div className="flex items-center gap-2 py-1 px-2 bg-background border rounded-lg shadow-lg">
              <Minus className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Separator</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Button onClick={() => setShowNewSection(true)} variant="outline" className="w-full" data-testid="button-add-section">
        <Plus className="h-4 w-4 mr-2" />
        Dodaj nową sekcję
      </Button>

      <Dialog open={showNewSection} onOpenChange={setShowNewSection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa sekcja</DialogTitle>
            <DialogDescription>Podaj nazwę, wybierz ikonę i kolor dla nowej sekcji menu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Nazwa sekcji"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              data-testid="input-section-title"
            />
            <div>
              <span className="text-sm font-medium mb-2 block">Kolor</span>
              <div className="flex flex-wrap gap-2">
                {SECTION_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setNewSectionColor(color.value)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-colors",
                      color.className.replace("text-", "bg-").replace("-400", "-500").replace("-500", "-400"),
                      newSectionColor === color.value ? "border-foreground scale-110" : "border-transparent"
                    )}
                    title={color.label}
                    data-testid={`color-option-${color.value}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium mb-2 block">Ikona</span>
              <IconPicker value={newSectionIcon} onChange={setNewSectionIcon} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSection(false)}>Anuluj</Button>
            <Button onClick={handleAddSection} disabled={!newSectionTitle.trim()} data-testid="button-confirm-add-section">
              <Plus className="h-4 w-4 mr-1.5" />
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAddLabel} onOpenChange={() => setShowAddLabel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dodaj etykietę</DialogTitle>
            <DialogDescription>Wprowadź tekst etykiety, która pojawi się w sekcji menu.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Tekst etykiety"
            value={newLabelText}
            onChange={(e) => setNewLabelText(e.target.value)}
            data-testid="input-label-text"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLabel(null)}>Anuluj</Button>
            <Button onClick={handleAddLabel} disabled={!newLabelText.trim()} data-testid="button-confirm-add-label">Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPresets} onOpenChange={setShowPresets}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Presety układu menu</DialogTitle>
            <DialogDescription>Wybierz gotowy układ menu. Twoje obecne ustawienia zostaną zastąpione.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {PRESET_LAYOUTS.map(preset => (
              <Card
                key={preset.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleApplyPreset(preset.id)}
                data-testid={`preset-${preset.id}`}
              >
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{preset.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import konfiguracji</DialogTitle>
            <DialogDescription>Wklej JSON z eksportu konfiguracji menu.</DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full h-40 p-3 text-xs border rounded-lg bg-background font-mono resize-none"
            placeholder='{"sections": [...]}'
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            data-testid="textarea-import-json"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Anuluj</Button>
            <Button onClick={handleImport} disabled={!importJson.trim()} data-testid="button-confirm-import">Importuj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
