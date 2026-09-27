import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Moon, Sun, Globe } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useI18n, type Lang } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — RailSwap" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <Section title="Appearance">
          <Row icon={theme === "dark" ? <Moon /> : <Sun />} label={t("darkMode")} right={<Switch checked={theme === "dark"} onCheckedChange={toggle} />} />
        </Section>

        <Section title="Language">
          <Row icon={<Globe />} label={t("language")} right={
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem><SelectItem value="hi">हिन्दी</SelectItem><SelectItem value="te">తెలుగు</SelectItem>
              </SelectContent>
            </Select>
          } />
        </Section>

        <Section title="Account">
          <Button variant="destructive" className="w-full" onClick={signOut}>{t("signOut")}</Button>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">{title}</p><div className="space-y-2">{children}</div></div>;
}
function Row({ icon, label, right }: { icon: React.ReactNode; label: string; right: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="size-8 rounded-lg bg-secondary flex items-center justify-center [&>svg]:size-4">{icon}</span><span className="text-sm font-medium">{label}</span></div>{right}</div>;
}
