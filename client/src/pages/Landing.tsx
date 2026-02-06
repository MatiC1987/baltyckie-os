import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, TrendingUp, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="font-display font-bold text-2xl text-primary">Bałtyckie</span>
          <Button onClick={() => window.location.href = "/api/login"} className="font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30">
            Zaloguj się
          </Button>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl lg:text-7xl font-display font-bold text-slate-900 leading-[1.1] mb-8">
              Zarządzaj <br />
              <span className="text-gradient">Apartamentami</span> <br />
              Profesjonalnie
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-lg">
              Kompletny system do zarządzania finansami, rezerwacjami i najmem długoterminowym. Zaprojektowany dla polskiego rynku nieruchomości.
            </p>
            <div className="flex gap-4">
              <Button size="lg" onClick={() => window.location.href = "/api/login"} className="text-lg px-8 py-6 h-auto shadow-xl shadow-primary/25 hover:translate-y-[-2px] transition-transform">
                Rozpocznij teraz <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-purple-500/20 rounded-3xl blur-3xl transform rotate-6 scale-110" />
            <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 overflow-hidden">
               {/* Decorative dashboard preview */}
               <div className="space-y-6 opacity-90">
                 <div className="flex gap-4">
                   <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="h-2 w-12 bg-slate-200 rounded mb-2" />
                     <div className="h-6 w-24 bg-primary/20 rounded" />
                   </div>
                   <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                     <div className="h-2 w-12 bg-slate-200 rounded mb-2" />
                     <div className="h-6 w-24 bg-green-500/20 rounded" />
                   </div>
                 </div>
                 <div className="h-48 bg-slate-50 rounded-xl border border-slate-100 w-full" />
                 <div className="space-y-2">
                   <div className="h-12 bg-slate-50 rounded-lg w-full" />
                   <div className="h-12 bg-slate-50 rounded-lg w-full" />
                   <div className="h-12 bg-slate-50 rounded-lg w-full" />
                 </div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: Building2,
                title: "Pełna Kontrola",
                desc: "Wszystkie apartamenty i rezerwacje w jednym miejscu. Przejrzysty widok kalendarza."
              },
              {
                icon: TrendingUp,
                title: "Analiza Finansowa",
                desc: "Śledź przychody, koszty i rentowność każdego lokalu. Automatyczne raporty."
              },
              {
                icon: ShieldCheck,
                title: "Bezpieczeństwo Danych",
                desc: "Twoje dane są bezpieczne i zawsze dostępne. Regularne kopie zapasowe."
              }
            ].map((feature, i) => (
              <div key={i} className="group p-8 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-primary">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
