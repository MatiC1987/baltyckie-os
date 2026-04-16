import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocumentCategory, DocumentTemplate } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Plus, Trash2, Download, FileText, Search, FolderPlus, Pencil,
  ArrowUpDown, ArrowUp, ArrowDown, Upload, X, FolderOpen, Tag, Files
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type SortKey = "name" | "category" | "fileName" | "uploadedAt";
type SortDir = "asc" | "desc";

export default function DocumentTemplates() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("uploadedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [catName, setCatName] = useState("");

  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docCategoryId, setDocCategoryId] = useState<string>("");
  const [docTemplateType, setDocTemplateType] = useState<string>("UMOWA");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [] } = useQuery<DocumentCategory[]>({
    queryKey: ["/api/document-categories"],
  });

  const { data: templates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  const createCatMut = useMutation({
    mutationFn: async (data: { name: string }) => apiRequest("POST", "/api/document-categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-categories"] });
      toast({ title: "Dodano kategorię" });
      setCatDialogOpen(false);
      setCatName("");
    },
  });

  const updateCatMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string } }) =>
      apiRequest("PUT", `/api/document-categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({ title: "Zaktualizowano kategorię" });
      setCatDialogOpen(false);
      setEditCatId(null);
      setCatName("");
    },
  });

  const deleteCatMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/document-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({ title: "Usunięto kategorię" });
    },
  });

  const deleteTemplateMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/document-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({ title: "Usunięto dokument" });
    },
  });

  const handleUploadDocument = async () => {
    if (!docFile || !docName.trim()) {
      toast({ title: "Błąd", description: "Nazwa i plik są wymagane", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName: docFile.name }),
      });
      if (!urlRes.ok) throw new Error("Nie udało się uzyskać URL do uploadu");
      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: docFile,
        headers: { "Content-Type": docFile.type || "application/octet-stream" },
      });
      if (!uploadRes.ok) throw new Error("Nie udało się przesłać pliku");

      await apiRequest("POST", "/api/document-templates", {
        name: docName.trim(),
        categoryId: docCategoryId ? parseInt(docCategoryId) : null,
        fileName: docFile.name,
        objectPath,
        description: docDescription.trim() || null,
        templateType: docTemplateType,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({ title: "Dodano dokument" });
      setDocDialogOpen(false);
      setDocName("");
      setDocDescription("");
      setDocCategoryId("");
      setDocTemplateType("UMOWA");
      setDocFile(null);
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const getCategoryName = (catId: number | null) => {
    if (!catId) return "Bez kategorii";
    return categories.find(c => c.id === catId)?.name || "—";
  };

  const filtered = useMemo(() => {
    let items = templates;
    if (filterCategory !== "all") {
      if (filterCategory === "none") {
        items = items.filter(t => !t.categoryId);
      } else {
        const catId = parseInt(filterCategory);
        items = items.filter(t => t.categoryId === catId);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.fileName.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [templates, filterCategory, searchQuery]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name": return dir * a.name.localeCompare(b.name, "pl");
        case "category": return dir * getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId), "pl");
        case "fileName": return dir * a.fileName.localeCompare(b.fileName, "pl");
        case "uploadedAt": return dir * ((a.uploadedAt || "").toString()).localeCompare((b.uploadedAt || "").toString());
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir, categories]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const openAddCategory = () => {
    setEditCatId(null);
    setCatName("");
    setCatDialogOpen(true);
  };

  const openEditCategory = (cat: DocumentCategory) => {
    setEditCatId(cat.id);
    setCatName(cat.name);
    setCatDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (!catName.trim()) return;
    if (editCatId) {
      updateCatMut.mutate({ id: editCatId, data: { name: catName.trim() } });
    } else {
      createCatMut.mutate({ name: catName.trim() });
    }
  };

  const formatDate = (d: string | Date | null) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("pl-PL");
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="Szablony dokumentów" description="Zarządzanie szablonami dokumentów." icon={Files} actions={
          <>
            <Button variant="outline" onClick={openAddCategory} data-testid="button-add-category">
              <FolderPlus className="h-4 w-4 mr-1" /> Dodaj kategorię
            </Button>
            <Button onClick={() => setDocDialogOpen(true)} data-testid="button-add-document">
              <Plus className="h-4 w-4 mr-1" /> Dodaj dokument
            </Button>
          </>
        } />
      </div>

      {categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Kategorie:</span>
          {categories.map(cat => (
            <Badge
              key={cat.id}
              variant="outline"
              className="cursor-pointer gap-1"
              data-testid={`badge-category-${cat.id}`}
            >
              <span onClick={() => openEditCategory(cat)}>{cat.name}</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="ml-1 opacity-50 hover:opacity-100" data-testid={`button-delete-category-${cat.id}`}>
                    <X className="h-3 w-3" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Usunąć kategorię?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Kategoria "{cat.name}" zostanie usunięta. Dokumenty z tą kategorią pozostaną, ale stracą przypisanie.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteCatMut.mutate(cat.id)}>Usuń</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj dokumentów..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-documents"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48" data-testid="select-filter-category">
            <SelectValue placeholder="Filtruj wg kategorii" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kategorie</SelectItem>
            <SelectItem value="none">Bez kategorii</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline">{filtered.length} dokumentów</Badge>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mb-2" />
            <p>Brak dokumentów</p>
            <p className="text-xs mt-1">Dodaj pierwszy dokument klikając "Dodaj dokument"</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")} data-testid="th-name">
                    <div className="flex items-center">Nazwa<SortIcon column="name" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("category")} data-testid="th-category">
                    <div className="flex items-center">Kategoria<SortIcon column="category" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("fileName")} data-testid="th-filename">
                    <div className="flex items-center">Plik<SortIcon column="fileName" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("uploadedAt")} data-testid="th-date">
                    <div className="flex items-center">Data dodania<SortIcon column="uploadedAt" /></div>
                  </TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((doc) => (
                  <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                    <TableCell>
                      <div className="font-medium">{doc.name}</div>
                      {doc.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{doc.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="text-xs w-fit">{getCategoryName(doc.categoryId)}</Badge>
                        <Badge
                          className="text-xs w-fit"
                          variant={
                            doc.templateType === "ANEKS" ? "default" :
                            doc.templateType === "NOTA" ? "secondary" :
                            doc.templateType === "INNY" ? "secondary" :
                            "outline"
                          }
                          data-testid={`badge-type-${doc.id}`}
                        >
                          {doc.templateType === "ANEKS" ? "Aneks" :
                           doc.templateType === "NOTA" ? "Nota" :
                           doc.templateType === "INNY" ? "Inny" :
                           "Umowa"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc.fileName}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(doc.uploadedAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <a href={doc.objectPath} target="_blank" rel="noopener noreferrer" data-testid={`button-download-${doc.id}`}>
                          <Button size="icon" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-document-${doc.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Usunąć dokument?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Dokument "{doc.name}" zostanie trwale usunięty.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Anuluj</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTemplateMut.mutate(doc.id)}>Usuń</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCatId ? "Edytuj kategorię" : "Dodaj kategorię"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nazwa kategorii</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="np. Umowy, Faktury, Regulaminy..."
                data-testid="input-category-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Anuluj</Button>
            <Button
              onClick={handleSaveCategory}
              disabled={!catName.trim() || createCatMut.isPending || updateCatMut.isPending}
              data-testid="button-save-category"
            >
              {editCatId ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj dokument</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nazwa dokumentu</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="np. Szablon umowy najmu"
                data-testid="input-document-name"
              />
            </div>
            <div>
              <Label>Typ szablonu</Label>
              <Select value={docTemplateType} onValueChange={setDocTemplateType}>
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UMOWA">Umowa / Kontrakt</SelectItem>
                  <SelectItem value="ANEKS">Aneks</SelectItem>
                  <SelectItem value="NOTA">Nota</SelectItem>
                  <SelectItem value="INNY">Inny</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select value={docCategoryId} onValueChange={setDocCategoryId}>
                <SelectTrigger data-testid="select-document-category">
                  <SelectValue placeholder="Wybierz kategorię (opcjonalnie)" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Opis (opcjonalnie)</Label>
              <Textarea
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder="Krótki opis dokumentu..."
                rows={2}
                data-testid="input-document-description"
              />
            </div>
            <div>
              <Label>Plik</Label>
              <div className="mt-1">
                {docFile ? (
                  <div className="flex items-center gap-2 text-sm border rounded-md p-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{docFile.name}</span>
                    <Button size="icon" variant="ghost" onClick={() => setDocFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 border border-dashed rounded-md p-4 cursor-pointer hover-elevate text-sm text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    Kliknij aby wybrać plik
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setDocFile(e.target.files[0]);
                      }}
                      data-testid="input-document-file"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>Anuluj</Button>
            <Button
              onClick={handleUploadDocument}
              disabled={uploading || !docName.trim() || !docFile}
              data-testid="button-save-document"
            >
              {uploading ? "Przesyłanie..." : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
