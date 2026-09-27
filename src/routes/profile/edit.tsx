import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/profile/edit")({
  head: () => ({ meta: [{ title: "Edit profile — RailSwap" }] }),
  component: EditProfile,
});

function EditProfile() {
  const { user, loading: aLoad } = useAuth();
  const { t, setLang } = useI18n();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", gender: "other", bio: "", language: "en", avatar_url: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setForm({
        name: data.name ?? "", gender: data.gender ?? "other", bio: data.bio ?? "",
        language: data.language ?? "en", avatar_url: data.avatar_url ?? "",
      });
    });
  }, [user]);

  if (aLoad) return null;
  if (!user) return <Navigate to="/login" />;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Image must be under 3MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    setForm(s => ({ ...s, avatar_url: publicUrl }));
    setUploading(false);
    toast.success("Photo uploaded");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...form });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setLang(form.language as Lang);
    toast.success("Profile updated");
    router.navigate({ to: "/profile" });
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-5">{t("editProfile")}</h1>
        <form onSubmit={save} className="space-y-4 rounded-3xl border bg-card p-5">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative size-20 rounded-2xl overflow-hidden bg-secondary flex items-center justify-center group">
              {form.avatar_url
                ? <img src={form.avatar_url} alt="avatar" className="size-full object-cover" />
                : <span className="text-2xl font-bold text-muted-foreground">{(form.name || "?")[0].toUpperCase()}</span>}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Camera className="size-5 text-white" />
              </span>
            </button>
            <div className="text-sm">
              <p className="font-medium">Profile photo</p>
              <p className="text-muted-foreground text-xs mb-1">Tap the avatar to change</p>
              <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Uploading…" : "Upload photo"}
              </Button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            </div>
          </div>

          <div className="space-y-1.5"><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div className="space-y-1.5">
            <Label>{t("gender")}</Label>
            <Select value={form.gender} onValueChange={v => setForm({...form, gender: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("male")}</SelectItem>
                <SelectItem value="female">{t("female")}</SelectItem>
                <SelectItem value="other">{t("other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("appLanguage")}</Label>
            <Select value={form.language} onValueChange={v => { setForm({...form, language: v}); setLang(v as Lang); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem><SelectItem value="hi">हिन्दी</SelectItem><SelectItem value="te">తెలుగు</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{t("bio")}</Label><Textarea rows={3} value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="Tell other passengers a bit about yourself." /></div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.history.back()}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-gradient-accent text-accent-foreground">{saving ? t("saving") : t("save")}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
