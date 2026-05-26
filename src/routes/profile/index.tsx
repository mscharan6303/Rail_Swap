import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit, Settings, Star, ShieldCheck, Award } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/profile/")({
  head: () => ({ meta: [{ title: "Profile — RailSwap" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading: aLoad } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => { setProfile(data); setLoading(false); });
  }, [user]);

  if (aLoad) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {loading ? <Skeleton className="h-48 rounded-3xl" /> : (
          <div className="rounded-3xl bg-gradient-hero text-white p-6 shadow-elevated relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 size-40 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center gap-4">
              <div className="size-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold overflow-hidden shrink-0">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" className="size-full object-cover" />
                  : (profile?.name ?? user.email ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold truncate">{profile?.name ?? "Traveller"}</h1>
                <p className="text-sm opacity-80 truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge icon={<ShieldCheck className="size-3" />} label="Verified" />
                  <Badge icon={<Star className="size-3" />} label={`${profile?.rating ?? "5.0"}★`} />
                  <Badge icon={<Award className="size-3" />} label={`${profile?.exchanges_count ?? 0} swaps`} />
                </div>
              </div>
            </div>
            {profile?.bio && <p className="mt-4 text-sm opacity-90">{profile.bio}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="rounded-xl h-12"><Link to="/profile/edit"><Edit className="size-4 mr-1.5" />Edit profile</Link></Button>
          <Button asChild variant="outline" className="rounded-xl h-12"><Link to="/settings"><Settings className="size-4 mr-1.5" />Settings</Link></Button>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h2 className="font-semibold mb-3">Trust & badges</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <BadgeCard icon={<ShieldCheck />} label="Verified" />
            <BadgeCard icon={<Star />} label="Trusted" />
            <BadgeCard icon={<Award />} label="Frequent" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Link to="/help" className="rounded-xl border p-3 hover:bg-secondary">Help & support</Link>
          <Link to="/about" className="rounded-xl border p-3 hover:bg-secondary">About RailSwap</Link>
          <Link to="/privacy" className="rounded-xl border p-3 hover:bg-secondary">Privacy</Link>
          <Link to="/terms" className="rounded-xl border p-3 hover:bg-secondary">Terms</Link>
        </div>
      </div>
    </AppShell>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur text-[11px] font-medium">{icon}{label}</span>;
}
function BadgeCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="size-8 mx-auto rounded-lg bg-gradient-accent text-accent-foreground flex items-center justify-center mb-1.5">{icon}</div>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
