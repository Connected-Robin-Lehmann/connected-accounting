import { useEffect, useState } from "react";
import { useNavigate, Link, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, Menu, X, FileText, Receipt } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const Layout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const NavLinks = () => (
    <>
      <Link to="/" onClick={() => setMobileMenuOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Button>
      </Link>
      <Link to="/clients" onClick={() => setMobileMenuOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Users className="h-4 w-4" />
          Clients
        </Button>
      </Link>
      <Link to="/invoices" onClick={() => setMobileMenuOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <FileText className="h-4 w-4" />
          Invoices
        </Button>
      </Link>
      <Link to="/expenses" onClick={() => setMobileMenuOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Receipt className="h-4 w-4" />
          Expenses
        </Button>
      </Link>
    </>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <nav className="bg-card border-b border-border shadow-soft sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Business Dashboard
              </h1>
              <div className="hidden md:flex space-x-4">
                <NavLinks />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-2 hidden sm:flex"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
              
              {/* Mobile menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[250px]">
                  <div className="flex flex-col gap-4 mt-8">
                    <NavLinks />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="gap-2 justify-start"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
