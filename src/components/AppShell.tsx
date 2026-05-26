import { Link, useRouter } from "@tanstack/react-router";
import { Home, Plus, User, Bell, Train, Moon, Sun, LogOut } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    // Fetch initial unread count
    supabase.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .then(({ count }) => {
        if (count !== null) setUnreadCount(count);
      });

    // Subscribe to realtime notifications
    const channel = supabase.channel('realtime_notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newNotification = payload.new as any;
        setUnreadCount(prev => prev + 1);
        toast(newNotification.title, {
          description: newNotification.body,
          action: {
            label: "View",
            onClick: () => router.navigate({ to: "/notifications" })
          }
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // Refresh count on any update (e.g. marked as read)
        supabase.from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false)
          .then(({ count }) => {
            if (count !== null) setUnreadCount(count);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, router]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="size-8 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow">
              <Train className="size-4 text-accent-foreground" />
            </span>
            <span>RailSwap</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavBtn to="/home" label={t("home")} />
            <NavBtn to="/requests" label={t("myRequests")} />
            <NavBtn to="/notifications" label={t("alerts")} badge={unreadCount} />
            <NavBtn to="/profile" label={t("profile")} />
          </nav>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {user ? (
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); router.navigate({ to: "/login" }); }} aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            ) : (
              <Button asChild size="sm" className="bg-gradient-accent text-accent-foreground hover:opacity-90">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-8">{children}</main>

      {user && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t">
          <div className="grid grid-cols-5 max-w-md mx-auto">
            <TabLink to="/home" icon={<Home className="size-5" />} label={t("home")} />
            <TabLink to="/requests" icon={<Train className="size-5" />} label={t("trips")} />
            <TabLink to="/create" icon={<Plus className="size-5" />} label="" highlight />
            <TabLink to="/notifications" icon={<Bell className="size-5" />} label={t("alerts")} badge={unreadCount} />
            <TabLink to="/profile" icon={<User className="size-5" />} label={t("you")} />
          </div>
        </nav>
      )}

      <footer className="border-t bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-muted-foreground flex flex-col md:flex-row gap-2 justify-between">
          <p>This app is not affiliated with IRCTC or Indian Railways.</p>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/help" className="hover:text-foreground">Help</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavBtn({ to, label, badge }: { to: string; label: string; badge?: number }) {
  return (
    <Link to={to} className="relative px-3 py-1.5 text-sm rounded-lg hover:bg-secondary transition-colors" activeProps={{ className: "px-3 py-1.5 text-sm rounded-lg bg-secondary text-secondary-foreground font-medium" }}>
      {label}
      {badge ? (
        <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  );
}

function TabLink({ to, icon, label, highlight, badge }: { to: string; icon: ReactNode; label: string; highlight?: boolean; badge?: number }) {
  if (highlight) {
    return (
      <Link to={to} className="flex items-center justify-center py-2">
        <span className="size-12 -mt-6 rounded-2xl bg-gradient-accent text-accent-foreground flex items-center justify-center shadow-glow">
          {icon}
        </span>
      </Link>
    );
  }
  return (
    <Link to={to} className="relative flex flex-col items-center gap-0.5 py-2 text-muted-foreground hover:text-foreground" activeProps={{ className: "flex flex-col items-center gap-0.5 py-2 text-accent" }}>
      <div className="relative">
        {icon}
        {badge ? (
          <span className="absolute -top-1 -right-1.5 min-w-3.5 h-3.5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
