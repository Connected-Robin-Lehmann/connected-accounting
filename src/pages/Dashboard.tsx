import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, FileText, TrendingUp } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { format, startOfMonth, parseISO } from "date-fns";

interface Stats {
  totalClients: number;
  totalPaid: number;
  totalPending: number;
  totalDocuments: number;
}

interface PaymentData {
  amount: number;
  status: string;
  paid_date: string | null;
  created_at: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalPaid: 0,
    totalPending: 0,
    totalDocuments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{
    monthly: Array<{ month: string; revenue: number; payments: number }>;
    timeline: Array<{ date: string; revenue: number }>;
    statusDistribution: Array<{ name: string; value: number; color: string }>;
  }>({
    monthly: [],
    timeline: [],
    statusDistribution: [],
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [clientsResult, paymentsResult, documentsResult] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("payments").select("amount, status, paid_date, created_at").eq("user_id", user.id),
        supabase.from("documents").select("id", { count: "exact" }).eq("user_id", user.id),
      ]);

      const payments = paymentsResult.data || [];

      const totalPaid = payments
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const totalPending = payments
        .filter((p) => p.status === "pending" || p.status === "overdue")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      setStats({
        totalClients: clientsResult.count || 0,
        totalPaid,
        totalPending,
        totalDocuments: documentsResult.count || 0,
      });

      // Process chart data
      processChartData(payments);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (payments: PaymentData[]) => {
    // Monthly revenue
    const monthlyMap = new Map<string, { revenue: number; count: number }>();
    
    // Timeline data (last 30 days of paid payments)
    const timelineMap = new Map<string, number>();
    
    // Status distribution
    const statusCount = { paid: 0, pending: 0, overdue: 0 };

    payments.forEach((payment) => {
      const amount = Number(payment.amount);
      
      // Status distribution
      if (payment.status === "paid") statusCount.paid += amount;
      else if (payment.status === "pending") statusCount.pending += amount;
      else if (payment.status === "overdue") statusCount.overdue += amount;

      // Monthly aggregation (paid payments only)
      if (payment.status === "paid" && payment.paid_date) {
        const monthKey = format(startOfMonth(parseISO(payment.paid_date)), "MMM yyyy");
        const existing = monthlyMap.get(monthKey) || { revenue: 0, count: 0 };
        monthlyMap.set(monthKey, {
          revenue: existing.revenue + amount,
          count: existing.count + 1,
        });

        // Timeline data
        const dateKey = format(parseISO(payment.paid_date), "MMM dd");
        timelineMap.set(dateKey, (timelineMap.get(dateKey) || 0) + amount);
      }
    });

    // Convert to arrays and sort
    const monthly = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        payments: data.count,
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-6); // Last 6 months

    const timeline = Array.from(timelineMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .slice(-30); // Last 30 days

    const statusDistribution = [
      { name: "Paid", value: statusCount.paid, color: "hsl(var(--success))" },
      { name: "Pending", value: statusCount.pending, color: "hsl(var(--warning))" },
      { name: "Overdue", value: statusCount.overdue, color: "hsl(var(--destructive))" },
    ].filter(item => item.value > 0);

    setChartData({ monthly, timeline, statusDistribution });
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

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
    payments: {
      label: "Payments",
      color: "hsl(var(--success))",
    },
  };

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

      {/* Charts Section */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Monthly Revenue Chart */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Monthly Revenue</CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">Last 6 months performance</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
              <BarChart data={chartData.monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `$${value}`}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="hsl(var(--primary))" 
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue Timeline */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Revenue Over Time</CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">Daily revenue trends</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
              <LineChart data={chartData.timeline}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `$${value}`}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Payment Status Distribution */}
        {chartData.statusDistribution.length > 0 && (
          <Card className="shadow-soft lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Payment Status Distribution</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">Total amounts by payment status</p>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
