import { useDashboardStats } from "@/hooks/use-stats";
import { useReservations } from "@/hooks/use-reservations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Users, CreditCard, Home } from "lucide-react";
import { DataTable } from "@/components/DataTable";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: reservations, isLoading: reservationsLoading } = useReservations();

  // Mock data for chart if not available in stats yet
  const chartData = [
    { name: 'Sty', revenue: 4000, expenses: 2400 },
    { name: 'Lut', revenue: 3000, expenses: 1398 },
    { name: 'Mar', revenue: 2000, expenses: 9800 },
    { name: 'Kwi', revenue: 2780, expenses: 3908 },
    { name: 'Maj', revenue: 1890, expenses: 4800 },
    { name: 'Cze', revenue: 2390, expenses: 3800 },
    { name: 'Lip', revenue: 3490, expenses: 4300 },
  ];

  if (statsLoading) {
    return <div className="p-8">Ładowanie danych...</div>;
  }

  const StatCard = ({ title, value, subtext, icon: Icon, trend }: any) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1 flex items-center">
          {trend === 'up' ? <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" /> : null}
          {trend === 'down' ? <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" /> : null}
          {subtext}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">Kokpit</h2>
        <p className="text-muted-foreground">Przegląd wyników finansowych i operacyjnych.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Przychody całkowite" 
          value={`${stats?.totalRevenue?.toFixed(2) ?? "0.00"} PLN`} 
          subtext="W tym roku" 
          icon={CreditCard}
          trend="up"
        />
        <StatCard 
          title="Koszty operacyjne" 
          value={`${stats?.totalExpenses?.toFixed(2) ?? "0.00"} PLN`} 
          subtext="-12% vs poprzedni miesiąc" 
          icon={ArrowDownRight}
          trend="down"
        />
        <StatCard 
          title="Dochód Netto" 
          value={`${stats?.netIncome?.toFixed(2) ?? "0.00"} PLN`} 
          subtext="Marża +24%" 
          icon={Home}
          trend="up"
        />
        <StatCard 
          title="Obłożenie" 
          value={`${stats?.occupancyRate?.toFixed(1) ?? "0"}%`} 
          subtext="Średnia z wszystkich lokali" 
          icon={Users}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4" data-testid="card-revenue-chart">
          <CardHeader>
            <CardTitle>Przychody i Koszty</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value} zł`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Przychód" />
                  <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Koszty" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3" data-testid="card-recent-reservations">
          <CardHeader>
            <CardTitle>Ostatnie Rezerwacje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {reservations?.slice(0, 5).map((res) => (
                 <div key={res.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {res.guestName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{res.guestName}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(res.startDate), 'dd MMM', { locale: pl })} - {format(new Date(res.endDate), 'dd MMM', { locale: pl })}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-bold">+{res.price} zł</div>
                 </div>
               ))}
               {!reservations?.length && <p className="text-sm text-muted-foreground text-center py-4">Brak ostatnich rezerwacji</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
