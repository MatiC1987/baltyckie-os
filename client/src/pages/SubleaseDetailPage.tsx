import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sublease, Apartment, SubleaseApartmentChange } from "@shared/schema";
import { ChevronLeft, User, CreditCard, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  SubleaseFormFields,
  PaymentsTab,
  ApartmentChangesSection,
  DocumentsTab,
} from "./Subleases";

export default function SubleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const subleaseId = Number(params.id);

  const [form, setForm] = useState<Record<string, any>>({
    tenantType: "osoba_fizyczna",
    startDate: "",
    endDate: "",
  });
  const [activeTab, setActiveTab] = useState("dane");
  const [initialized, setInitialized] = useState(false);

  const { data: subleases = [], isLoading: loadingSub } = useQuery<Sublease[]>({
    queryKey: ["/api/subleases"],
  });
  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ["/api/apartments"],
  });
  const { data: allApartmentChanges = [] } = useQuery<SubleaseApartmentChange[]>({
    queryKey: ["/api/sublease-apartment-changes/all"],
  });

  const sublease = subleases.find((s) => s.id === subleaseId);

  useEffect(() => {
    if (sublease && !initialized) {
      setForm({
        tenantType: sublease.tenantType,
        firstName: sublease.firstName || "",
        lastName: sublease.lastName || "",
        companyName: sublease.companyName || "",
        nip: sublease.nip || "",
        street: sublease.street || "",
        postalCode: sublease.postalCode || "",
        city: sublease.city || "",
        peselOrPassport: sublease.peselOrPassport || "",
        idNumber: sublease.idNumber || "",
        phone: sublease.phone || "",
        email: sublease.email || "",
        invoiceEmail: sublease.invoiceEmail || "",
        vatRate: sublease.vatRate || "23%",
        apartmentId: sublease.apartmentId,
        apartmentIds: sublease.apartmentIds || (sublease.apartmentId ? [sublease.apartmentId] : []),
        startDate: sublease.startDate,
        endDate: sublease.endDate,
        rentAmount: sublease.rentAmount || "",
        additionalFees: sublease.additionalFees || "",
        paymentDay: sublease.paymentDay || "",
        mediaByMeters: sublease.mediaByMeters || false,
        hasDeposit: sublease.hasDeposit || false,
        depositAmount: sublease.depositAmount || "",
        depositReturnDate: sublease.depositReturnDate || "",
        status: sublease.status || "AKTYWNA",
        comment: sublease.comment || "",
      });
      setInitialized(true);
    }
  }, [sublease, initialized]);

  const updateMut = useMutation({
    mutationFn: async (data: any) => apiRequest("PUT", `/api/subleases/${subleaseId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subleases"] });
      toast({ title: "Sukces", description: "Zaktualizowano umowę" });
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!form.startDate || !form.endDate) {
      toast({ title: "Błąd", description: "Daty są wymagane", variant: "destructive" });
      return;
    }
    updateMut.mutate(form);
  };

  const getTenantLabel = () => {
    if (!sublease) return "";
    if (sublease.tenantType === "firma") return sublease.companyName || "—";
    return [sublease.firstName, sublease.lastName].filter(Boolean).join(" ") || "—";
  };

  const relevantApartments = (() => {
    const baseIds: number[] = form.apartmentIds || (form.apartmentId ? [form.apartmentId] : []);
    const changeIds = allApartmentChanges
      .filter((ch) => ch.subleaseId === subleaseId)
      .map((ch) => ch.newApartmentId);
    const combined = [...baseIds, ...changeIds];
    const allIds = combined.filter((id, idx) => combined.indexOf(id) === idx);
    return apartments.filter((a) => allIds.includes(a.id));
  })();

  if (loadingSub && subleases.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loadingSub && !sublease) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/podnajem?tab=umowy")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Powrót
        </Button>
        <p className="text-muted-foreground">Nie znaleziono umowy podnajmu o ID {subleaseId}.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3 pb-1 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/podnajem?tab=umowy")}
          data-testid="btn-back-podnajem"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Powrót
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">
            {getTenantLabel() || "Edytuj umowę"}
          </h1>
          {sublease && (
            <p className="text-sm text-muted-foreground">
              {sublease.startDate} – {sublease.endDate}
            </p>
          )}
        </div>
        {activeTab === "dane" && (
          <LoadingButton
            onClick={handleSave}
            isPending={updateMut.isPending}
            loadingText="Zapisywanie..."
            data-testid="btn-save-sublease-detail"
          >
            Zapisz zmiany
          </LoadingButton>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dane" className="gap-1" data-testid="tab-detail-dane">
            <User className="h-4 w-4" /> Dane
          </TabsTrigger>
          <TabsTrigger value="oplaty" className="gap-1" data-testid="tab-detail-oplaty">
            <CreditCard className="h-4 w-4" /> Opłaty
          </TabsTrigger>
          <TabsTrigger value="dokumenty" className="gap-1" data-testid="tab-detail-dokumenty">
            <Paperclip className="h-4 w-4" /> Dokumenty
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dane" className="mt-4">
          <div className="max-w-2xl space-y-0">
            <SubleaseFormFields form={form} setForm={setForm} apartments={apartments} constrained={false} />
            <ApartmentChangesSection
              subleaseId={subleaseId}
              apartments={apartments}
              currentApartmentIds={form.apartmentIds || (form.apartmentId ? [form.apartmentId] : [])}
            />
          </div>
        </TabsContent>

        <TabsContent value="oplaty" className="mt-4">
          <PaymentsTab
            subleaseId={subleaseId}
            apartments={relevantApartments}
            startDate={form.startDate}
            endDate={form.endDate}
          />
        </TabsContent>

        <TabsContent value="dokumenty" className="mt-4">
          <DocumentsTab
            subleaseId={subleaseId}
            sublease={sublease}
            apartments={apartments}
            currentRentAmount={form.rentAmount}
            currentStartDate={form.startDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
