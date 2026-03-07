import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CompanySettings as CompanySettingsType } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Save, Upload, X, Globe, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

function validateNIP(nip: string): { valid: boolean; message: string } {
  const cleaned = nip.replace(/[\s-]/g, "");
  if (!cleaned) return { valid: true, message: "" };
  if (!/^\d{10}$/.test(cleaned)) return { valid: false, message: "NIP musi mieć 10 cyfr" };
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * weights[i];
  }
  const checkDigit = sum % 11;
  if (checkDigit === 10) return { valid: false, message: "Nieprawidłowa suma kontrolna NIP" };
  if (checkDigit !== parseInt(cleaned[9])) return { valid: false, message: "Nieprawidłowa suma kontrolna NIP" };
  return { valid: true, message: "NIP prawidłowy" };
}

function validateREGON(regon: string): { valid: boolean; message: string } {
  const cleaned = regon.replace(/[\s-]/g, "");
  if (!cleaned) return { valid: true, message: "" };
  if (!/^\d{9}$/.test(cleaned) && !/^\d{14}$/.test(cleaned)) {
    return { valid: false, message: "REGON musi mieć 9 lub 14 cyfr" };
  }
  if (cleaned.length === 9) {
    const weights9 = [8, 9, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(cleaned[i]) * weights9[i];
    }
    const checkDigit = sum % 11 === 10 ? 0 : sum % 11;
    if (checkDigit !== parseInt(cleaned[8])) return { valid: false, message: "Nieprawidłowa suma kontrolna REGON" };
  } else {
    const weights14 = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleaned[i]) * weights14[i];
    }
    const checkDigit = sum % 11 === 10 ? 0 : sum % 11;
    if (checkDigit !== parseInt(cleaned[13])) return { valid: false, message: "Nieprawidłowa suma kontrolna REGON" };
  }
  return { valid: true, message: "REGON prawidłowy" };
}

function ValidationIndicator({ result }: { result: { valid: boolean; message: string } }) {
  if (!result.message) return null;
  return (
    <div className={`flex items-center gap-1 mt-1 text-xs ${result.valid ? "text-green-600 dark:text-green-400" : "text-destructive"}`} data-testid={`text-validation-${result.valid ? "ok" : "error"}`}>
      {result.valid ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      <span>{result.message}</span>
    </div>
  );
}

export default function CompanySettings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const darkFileInputRef = useRef<HTMLInputElement>(null);

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
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);

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
      if (settings.logoDarkUrl) {
        setLogoDarkPreview(`/api/company-settings/logo-dark?t=${Date.now()}`);
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

  const logoDarkUpload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/company-settings/logo-dark", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Blad uploadu");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      setLogoDarkPreview(`/api/company-settings/logo-dark?t=${Date.now()}`);
      toast({ title: "Logo (tryb ciemny) zostalo zapisane" });
    },
    onError: () => {
      toast({ title: "Blad", description: "Nie udalo sie zapisac logo", variant: "destructive" });
    },
  });

  const removeDarkLogo = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/company-settings", { logoDarkUrl: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      setLogoDarkPreview(null);
      toast({ title: "Logo (tryb ciemny) zostalo usuniete" });
    },
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nipResult = validateNIP(form.nip);
    const regonResult = validateREGON(form.regon);
    if (!nipResult.valid) {
      toast({ title: "Błąd walidacji", description: nipResult.message, variant: "destructive" });
      return;
    }
    if (!regonResult.valid) {
      toast({ title: "Błąd walidacji", description: regonResult.message, variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      logoUpload.mutate(file);
    }
  };

  const handleDarkLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      logoDarkUpload.mutate(file);
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
          <div className="mb-6 space-y-4">
            <Label className="text-sm font-medium">Logo firmy</Label>
            <p className="text-xs text-muted-foreground">Logo bedzie wyswietlane w naglowku generowanych dokumentow i na stronie logowania. Wgraj osobne wersje dla jasnego i ciemnego motywu.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Jasny motyw (na bialym tle)</Label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo firmy (jasny motyw)"
                        className="h-16 max-w-[180px] object-contain border rounded-md p-1 bg-white"
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
                    <div className="h-16 w-[180px] border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground text-xs bg-white">
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
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUpload.isPending}
                      data-testid="button-upload-logo"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {logoUpload.isPending ? "..." : "Wgraj"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ciemny motyw (na ciemnym tle)</Label>
                <div className="flex items-center gap-3">
                  {logoDarkPreview ? (
                    <div className="relative">
                      <img
                        src={logoDarkPreview}
                        alt="Logo firmy (ciemny motyw)"
                        className="h-16 max-w-[180px] object-contain border rounded-md p-1 bg-slate-800"
                        data-testid="img-company-logo-dark"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground"
                        onClick={() => removeDarkLogo.mutate()}
                        disabled={removeDarkLogo.isPending}
                        data-testid="button-remove-logo-dark"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-16 w-[180px] border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground text-xs bg-slate-800 text-slate-400">
                      Brak logo
                    </div>
                  )}
                  <div>
                    <input
                      ref={darkFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleDarkLogoSelect}
                      data-testid="input-logo-dark-file"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => darkFileInputRef.current?.click()}
                      disabled={logoDarkUpload.isPending}
                      data-testid="button-upload-logo-dark"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {logoDarkUpload.isPending ? "..." : "Wgraj"}
                    </Button>
                  </div>
                </div>
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
                  placeholder="0000000000"
                  data-testid="input-nip"
                />
                <ValidationIndicator result={validateNIP(form.nip)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="regon">REGON</Label>
                <Input
                  id="regon"
                  value={form.regon}
                  onChange={handleChange("regon")}
                  placeholder="000000000"
                  data-testid="input-regon"
                />
                <ValidationIndicator result={validateREGON(form.regon)} />
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
