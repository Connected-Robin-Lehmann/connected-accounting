import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, FileText, TrendingUp } from "lucide-react";

interface Stats {
  totalClients: number;
  totalPaid: number;
  totalPending: number;
  totalDocuments: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalPaid: 0,
    totalPending: 0,
    totalDocuments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [clientsResult, paymentsResult, documentsResult] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("payments").select("amount, status").eq("user_id", user.id),
        supabase.from("documents").select("id", { count: "exact" }).eq("user_id", user.id),
      ]);

      const totalPaid = paymentsResult.data
        ?.filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalPending = paymentsResult.data
        ?.filter((p) => p.status === "pending" || p.status === "overdue")
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        totalClients: clientsResult.count || 0,
        totalPaid,
        totalPending,
        totalDocuments: documentsResult.count || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Clients",
      value: stats.totalClients,
      icon: Users,
      gradient: "bg-gradient-primary",
    },
    {
      title: "Total Revenue",
      value: `$${stats.totalPaid.toFixed(2)}`,
      icon: DollarSign,
      gradient: "bg-gradient-to-br from-success to-emerald-600",
    },
    {
      title: "Pending Payments",
      value: `$${stats.totalPending.toFixed(2)}`,
      icon: TrendingUp,
      gradient: "bg-gradient-to-br from-warning to-orange-600",
    },
    {
      title: "Documents",
      value: stats.totalDocuments,
      icon: FileText,
      gradient: "bg-gradient-to-br from-info to-cyan-600",
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-8 w-8 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Your business metrics at a glance
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.gradient}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
