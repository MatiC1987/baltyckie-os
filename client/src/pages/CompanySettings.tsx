import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CompanySettings as CompanySettingsType } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function CompanySettings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<CompanySettingsType>({
    queryKey: ["/api/company-settings"],
  });

  const [form, setForm] = useState({
    companyName: "",
    nip: "",
    regon: "",
    street: "",
    postalCode: "",
    city: "",
    bankAccount: "",
    bankName: "",
    representativeName: "",
    representativeRole: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName || "",
        nip: settings.nip || "",
        regon: settings.regon || "",
        street: settings.street || "",
        postalCode: settings.postalCode || "",
        city: settings.city || "",
        bankAccount: settings.bankAccount || "",
        bankName: settings.bankName || "",
        representativeName: settings.representativeName || "",
        representativeRole: settings.representativeRole || "",
        phone: settings.phone || "",
        email: settings.email || "",
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => apiRequest("PUT", "/api/company-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      toast({ title: "Zapisano dane firmowe" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zapisać danych", variant: "destructive" });
    },
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Dane firmowe"
        description="Dane Twojej firmy uzywane w generowanych umowach podnajmu"
        icon={Building2}
      />

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-company-settings">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Nazwa firmy</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={handleChange("companyName")}
                  data-testid="input-company-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nip">NIP</Label>
                <Input
                  id="nip"
                  value={form.nip}
                  onChange={handleChange("nip")}
                  data-testid="input-nip"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="regon">REGON</Label>
                <Input
                  id="regon"
                  value={form.regon}
                  onChange={handleChange("regon")}
                  data-testid="input-regon"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="street">Ulica i numer</Label>
                <Input
                  id="street"
                  value={form.street}
                  onChange={handleChange("street")}
                  data-testid="input-street"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">Kod pocztowy</Label>
                <Input
                  id="postalCode"
                  value={form.postalCode}
                  onChange={handleChange("postalCode")}
                  data-testid="input-postal-code"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Miasto</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={handleChange("city")}
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankAccount">Numer konta bankowego</Label>
                <Input
                  id="bankAccount"
                  value={form.bankAccount}
                  onChange={handleChange("bankAccount")}
                  data-testid="input-bank-account"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankName">Nazwa banku</Label>
                <Input
                  id="bankName"
                  value={form.bankName}
                  onChange={handleChange("bankName")}
                  data-testid="input-bank-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="representativeName">Imię i nazwisko reprezentanta</Label>
                <Input
                  id="representativeName"
                  value={form.representativeName}
                  onChange={handleChange("representativeName")}
                  data-testid="input-representative-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="representativeRole">Stanowisko reprezentanta</Label>
                <Input
                  id="representativeRole"
                  value={form.representativeRole}
                  onChange={handleChange("representativeRole")}
                  placeholder="np. Prezes Zarzadu"
                  data-testid="input-representative-role"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={handleChange("phone")}
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  data-testid="input-email"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-company-settings">
                <Save className="h-4 w-4 mr-1" />
                {mutation.isPending ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
