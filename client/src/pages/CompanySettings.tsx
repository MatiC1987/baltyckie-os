import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CompanySettings as CompanySettingsType } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Save, Upload, X, Globe } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function CompanySettings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    websiteUrl: "",
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
        websiteUrl: settings.websiteUrl || "",
      });
      if (settings.logoUrl) {
        setLogoPreview(`/api/company-settings/logo?t=${Date.now()}`);
      }
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => apiRequest("PUT", "/api/company-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      toast({ title: "Zapisano dane firmowe" });
    },
    onError: () => {
      toast({ title: "Blad", description: "Nie udalo sie zapisac danych", variant: "destructive" });
    },
  });

  const logoUpload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/company-settings/logo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Blad uploadu");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      setLogoPreview(`/api/company-settings/logo?t=${Date.now()}`);
      toast({ title: "Logo zostalo zapisane" });
    },
    onError: () => {
      toast({ title: "Blad", description: "Nie udalo sie zapisac logo", variant: "destructive" });
    },
  });

  const removeLogo = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/company-settings", { logoUrl: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      setLogoPreview(null);
      toast({ title: "Logo zostalo usuniete" });
    },
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      logoUpload.mutate(file);
    }
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
          <div className="mb-6 space-y-3">
            <Label className="text-sm font-medium">Logo firmy</Label>
            <p className="text-xs text-muted-foreground">Logo bedzie wyswietlane w naglowku generowanych dokumentow (umowy, noty ksiegowe)</p>
            <div className="flex items-center gap-4 flex-wrap">
              {logoPreview ? (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo firmy"
                    className="h-16 max-w-[200px] object-contain border rounded-md p-1"
                    data-testid="img-company-logo"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground"
                    onClick={() => removeLogo.mutate()}
                    disabled={removeLogo.isPending}
                    data-testid="button-remove-logo"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="h-16 w-[200px] border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground text-xs">
                  Brak logo
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleLogoSelect}
                  data-testid="input-logo-file"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUpload.isPending}
                  data-testid="button-upload-logo"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {logoUpload.isPending ? "Przesylanie..." : "Wgraj logo"}
                </Button>
              </div>
            </div>
          </div>

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
                <Label htmlFor="representativeName">Imie i nazwisko reprezentanta</Label>
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
              <div className="space-y-1.5">
                <Label htmlFor="websiteUrl" className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Strona internetowa
                </Label>
                <Input
                  id="websiteUrl"
                  value={form.websiteUrl}
                  onChange={handleChange("websiteUrl")}
                  placeholder="https://www.przyklad.pl"
                  data-testid="input-website-url"
                />
                <p className="text-xs text-muted-foreground">Link do strony bedzie zakodowany w QR na dole dokumentow</p>
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
