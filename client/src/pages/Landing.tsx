import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import logoImg from "@assets/base_logo_white_background_1770751806017.png";

export default function Landing() {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-10">
        <img
          src={logoImg}
          alt="Bałtyckie Apartamenty"
          className="w-64 h-auto"
          data-testid="img-logo"
        />
        <Button
          size="lg"
          onClick={() => window.location.href = "/api/login"}
          className="text-base px-10 bg-[#051F51] text-white border-[#051F51]"
          data-testid="button-login"
        >
          <LogIn className="mr-2 h-4 w-4" />
          Zaloguj
        </Button>
      </div>
    </div>
  );
}
