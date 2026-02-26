import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRecepcjaAuth } from "./RecepcjaApp";
import { Loader2, Lock } from "lucide-react";
import logoImg from "@assets/base_logo_white_background_1770751806017.png";

export default function RecepcjaLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useRecepcjaAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      toast({ title: "Błąd logowania", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-sm p-8 space-y-6" data-testid="card-recepcja-login">
        <div className="flex flex-col items-center gap-4">
          <img src={logoImg} alt="Logo" className="h-16 w-auto rounded-lg" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground" data-testid="text-recepcja-title">Bałtyckie - Recepcja</h1>
            <p className="text-sm text-muted-foreground mt-1">Panel kierownika recepcji</p>
          </div>
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@baltyckie.pl"
              data-testid="input-recepcja-email"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              data-testid="input-recepcja-password"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="button-recepcja-login">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Zaloguj się
          </Button>
        </form>
      </Card>
    </div>
  );
}