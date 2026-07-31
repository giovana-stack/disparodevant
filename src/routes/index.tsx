import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Newspaper,
  BarChart3,
  Link2,
  CalendarDays,
  LogOut,
  Loader2,
  Trash2,
  Send,
  Sparkles,
  Plus,
  X,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

import { getAuthState, unlockApp, lockApp } from "@/lib/auth.functions";
import {
  listPendingNoticias,
  listSentNoticias,
  listSent,
  approveNoticia,
  discardNoticia,
  dispararEnquete,
  dispararPost,
  buscarNovasNoticias,
} from "@/lib/rascunhos.functions";
import { gerarEnquete, gerarChamadaPost } from "@/lib/gemini.functions";

export const Route = createFileRoute("/")({
  loader: () => getAuthState(),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  if (!initial.unlocked) return <Login onUnlocked={() => router.invalidate()} />;
  return <AppShell />;
}

/* ---------------- LOGIN ---------------- */
function Login({ onUnlocked }: { onUnlocked: () => void }) {
  const unlock = useServerFn(unlockApp);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await unlock({ data: { password } });
      if (r.ok) {
        toast.success("Bem-vindo!");
        onUnlocked();
      } else {
        toast.error("Senha incorreta");
      }
    } catch {
      toast.error("Erro ao validar a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl">Disparos WhatsApp</CardTitle>
          <p className="text-sm text-muted-foreground">Acesso restrito</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Senha</Label>
              <Input
                id="pw"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- APP SHELL ---------------- */
function AppShell() {
  const [tab, setTab] = useState("noticias");
  const router = useRouter();
  const lock = useServerFn(lockApp);

  async function sair() {
    await lock();
    router.invalidate();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="font-semibold text-sm">Disparos WhatsApp</div>
          </div>
          <Button variant="ghost" size="sm" onClick={sair}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-24">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full sticky top-14 z-10">
            <TabsTrigger value="noticias" className="flex-col gap-0.5 py-2 text-[11px]">
              <Newspaper className="w-4 h-4" /> Notícias
            </TabsTrigger>
            <TabsTrigger value="enquete" className="flex-col gap-0.5 py-2 text-[11px]">
              <BarChart3 className="w-4 h-4" /> Enquete
            </TabsTrigger>
            <TabsTrigger value="post" className="flex-col gap-0.5 py-2 text-[11px]">
              <Link2 className="w-4 h-4" /> Post
            </TabsTrigger>
            <TabsTrigger value="calendario" className="flex-col gap-0.5 py-2 text-[11px]">
              <CalendarDays className="w-4 h-4" /> Calendário
            </TabsTrigger>
          </TabsList>

          <TabsContent value="noticias" className="mt-4">
            <NoticiasTab />
          </TabsContent>
          <TabsContent value="enquete" className="mt-4">
            <EnqueteTab />
          </TabsContent>
          <TabsContent value="post" className="mt-4">
            <PostTab />
          </TabsContent>
          <TabsContent value="calendario" className="mt-4">
            <CalendarioTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- ABA 1: NOTÍCIAS ---------------- */
function NoticiasTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingNoticias);
  const approveFn = useServerFn(approveNoticia);
  const discardFn = useServerFn(discardNoticia);
  const buscarFn = useServerFn(buscarNovasNoticias);
  const [buscando, setBuscando] = useState(false);

  const q = useQuery({ queryKey: ["noticias-pendentes"], queryFn: () => listFn() });

  async function buscar() {
    setBuscando(true);
    try {
      await buscarFn();
      toast.success("Notícias atualizadas!");
      await qc.invalidateQueries({ queryKey: ["noticias-pendentes"] });
    } catch (e) {
      const msg = (e as Error)?.message || "";
      toast.error(
        msg.includes("abort") || msg.includes("timeout")
          ? "A busca demorou demais. Tente novamente."
          : "Não foi possível buscar. Tente novamente.",
      );
    } finally {
      setBuscando(false);
    }
  }

  const buscarBtn = (
    <Button onClick={buscar} disabled={buscando} className="w-full">
      {buscando ? (
        <>
          <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Buscando...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 mr-1" /> Buscar novas notícias
        </>
      )}
    </Button>
  );

  if (q.isLoading) return <div className="space-y-3">{buscarBtn}<Loading /></div>;
  if (q.error) return <div className="space-y-3">{buscarBtn}<ErrorBox error={q.error} /></div>;
  const items = q.data ?? [];

  return (
    <div className="space-y-3">
      {buscarBtn}
      {items.length === 0 ? (
        <EmptyBox icon={<Newspaper className="w-6 h-6" />} text="Nenhuma notícia pendente." />
      ) : (
        items.map((r) => (
          <NoticiaCard
            key={String(r.id)}
            rascunho={r}
            onApprove={async (msg) => {
              await approveFn({ data: { id: r.id, mensagem: msg } });
              toast.success("Disparado!");
              qc.invalidateQueries({ queryKey: ["noticias-pendentes"] });
              qc.invalidateQueries({ queryKey: ["noticias-enviadas"] });
              qc.invalidateQueries({ queryKey: ["enviados"] });
            }}
            onDiscard={async () => {
              await discardFn({ data: { id: r.id } });
              toast.success("Descartado");
              qc.invalidateQueries({ queryKey: ["noticias-pendentes"] });
            }}
          />
        ))
      )}
    </div>
  );
}

function NoticiaCard({
  rascunho,
  onApprove,
  onDiscard,
}: {
  rascunho: { id: string | number; titulo: string | null; mensagem: string | null };
  onApprove: (msg: string) => Promise<void>;
  onDiscard: () => Promise<void>;
}) {
  const [msg, setMsg] = useState(rascunho.mensagem ?? "");
  const [busy, setBusy] = useState<null | "approve" | "discard">(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base leading-snug">
          {rascunho.titulo || "Sem título"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={8}
          className="min-h-[180px] text-sm leading-relaxed"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("discard");
              try {
                await onDiscard();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "discard" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1" />
                Descartar
              </>
            )}
          </Button>
          <Button
            disabled={busy !== null || !msg.trim()}
            onClick={async () => {
              setBusy("approve");
              try {
                await onApprove(msg);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "approve" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                Aprovar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- ABA 2: ENQUETE ---------------- */
function EnqueteTab() {
  const qc = useQueryClient();
  const listSentNoticiasFn = useServerFn(listSentNoticias);
  const gerarFn = useServerFn(gerarEnquete);
  const dispararFn = useServerFn(dispararEnquete);

  const noticiasQ = useQuery({
    queryKey: ["noticias-enviadas"],
    queryFn: () => listSentNoticiasFn(),
  });

  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState<string[]>(["", ""]);
  const [selecionada, setSelecionada] = useState<string>("");
  const [gerando, setGerando] = useState(false);
  const [disparando, setDisparando] = useState(false);

  function setOpcao(i: number, v: string) {
    setOpcoes((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  }
  function addOpcao() {
    if (opcoes.length < 5) setOpcoes([...opcoes, ""]);
  }
  function removeOpcao(i: number) {
    if (opcoes.length > 2) setOpcoes(opcoes.filter((_, idx) => idx !== i));
  }

  async function gerar() {
    const noticia = noticiasQ.data?.find((n) => String(n.id) === selecionada);
    if (!noticia) return;
    setGerando(true);
    try {
      const base = [noticia.titulo, noticia.mensagem].filter(Boolean).join("\n\n");
      const r = await gerarFn({ data: { noticia: base } });
      setPergunta(r.pergunta);
      setOpcoes(r.opcoes.length >= 2 ? r.opcoes : [...r.opcoes, "", ""].slice(0, 3));
      toast.success("Enquete gerada — revise antes de disparar");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  async function disparar() {
    setDisparando(true);
    try {
      await dispararFn({
        data: { pergunta, opcoes: opcoes.map((o) => o.trim()).filter(Boolean) },
      });
      toast.success("Enquete disparada!");
      setPergunta("");
      setOpcoes(["", ""]);
      setSelecionada("");
      qc.invalidateQueries({ queryKey: ["enviados"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDisparando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Gerar automaticamente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Baseada em uma notícia enviada</Label>
          <Select value={selecionada} onValueChange={setSelecionada}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma notícia..." />
            </SelectTrigger>
            <SelectContent>
              {(noticiasQ.data ?? []).map((n) => (
                <SelectItem key={String(n.id)} value={String(n.id)}>
                  {(n.titulo || n.mensagem || "").slice(0, 80)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            className="w-full"
            disabled={!selecionada || gerando}
            onClick={gerar}
          >
            {gerando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1" />
                Gerar enquete
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Enquete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pergunta">Pergunta</Label>
            <Textarea
              id="pergunta"
              rows={2}
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Ex.: O que você achou dessa notícia?"
            />
          </div>
          <div className="space-y-2">
            <Label>Opções ({opcoes.length}/5)</Label>
            {opcoes.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={o}
                  onChange={(e) => setOpcao(i, e.target.value)}
                  placeholder={`Opção ${i + 1}`}
                />
                {opcoes.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => removeOpcao(i)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {opcoes.length < 5 && (
              <Button variant="outline" size="sm" onClick={addOpcao} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Adicionar opção
              </Button>
            )}
          </div>
          <Button
            className="w-full"
            disabled={disparando || !pergunta.trim() || opcoes.filter((o) => o.trim()).length < 2}
            onClick={disparar}
          >
            {disparando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" /> Disparar enquete
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- ABA 3: POST ---------------- */
function PostTab() {
  const qc = useQueryClient();
  const dispararFn = useServerFn(dispararPost);
  const gerarFn = useServerFn(gerarChamadaPost);
  const [origem, setOrigem] = useState<"instagram" | "linkedin">("instagram");
  const [link, setLink] = useState("");
  const [textoPost, setTextoPost] = useState("");
  const [chamada, setChamada] = useState("");

  const gerarMut = useMutation({
    mutationFn: () => gerarFn({ data: { origem, texto: textoPost, link } }),
    onSuccess: (r) => {
      setChamada(r.chamada);
      toast.success("Chamada gerada!");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mut = useMutation({
    mutationFn: () => dispararFn({ data: { origem, link, chamada } }),
    onSuccess: () => {
      toast.success("Post disparado!");
      setLink("");
      setChamada("");
      setTextoPost("");
      qc.invalidateQueries({ queryKey: ["enviados"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Divulgar post</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Origem</Label>
          <Select value={origem} onValueChange={(v) => setOrigem(v as "instagram" | "linkedin")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="link">Link do post</Label>
          <Input
            id="link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="textoPost">Cole aqui o texto do post</Label>
          <Textarea
            id="textoPost"
            rows={6}
            value={textoPost}
            onChange={(e) => setTextoPost(e.target.value)}
            placeholder="Cole o conteúdo/legenda completa do post..."
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={gerarMut.isPending || !textoPost.trim()}
            onClick={() => gerarMut.mutate()}
          >
            {gerarMut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Gerar chamada com IA"
            )}
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="chamada">Texto de chamada</Label>
          <Textarea
            id="chamada"
            rows={4}
            value={chamada}
            onChange={(e) => setChamada(e.target.value)}
            placeholder="Escreva a chamada que acompanhará o link..."
          />
        </div>
        <Button
          className="w-full"
          disabled={mut.isPending || !link.trim() || !chamada.trim()}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4 mr-1" /> Disparar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- ABA 4: CALENDÁRIO ---------------- */
const TIPO_LABEL: Record<string, string> = {
  noticia: "Notícia",
  enquete: "Enquete",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  post_ig: "Post Instagram",
};
const TIPO_CLASS: Record<string, string> = {
  noticia: "bg-[var(--tipo-noticia)] text-white",
  enquete: "bg-[var(--tipo-enquete)] text-white",
  instagram: "bg-[var(--tipo-instagram)] text-white",
  linkedin: "bg-[var(--tipo-linkedin)] text-white",
  post_ig: "bg-[var(--tipo-post-ig)] text-white",
};

function ymd(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}

function CalendarioTab() {
  const listFn = useServerFn(listSent);
  const listIgFn = useServerFn(listPostagensInstagram);
  const q = useQuery({ queryKey: ["enviados"], queryFn: () => listFn() });
  const igQ = useQuery({ queryKey: ["postagens-instagram"], queryFn: () => listIgFn() });
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  const byDay = useMemo(() => {
    const m = new Map<string, Array<{ id: string; tipo: string; titulo: string | null; mensagem: string | null }>>();
    const push = (k: string, item: { id: string; tipo: string; titulo: string | null; mensagem: string | null }) => {
      const arr = m.get(k) ?? [];
      arr.push(item);
      m.set(k, arr);
    };
    for (const r of q.data ?? []) {
      if (!r.enviado_em) continue;
      push(ymd(r.enviado_em), {
        id: String(r.id),
        tipo: r.tipo,
        titulo: r.titulo,
        mensagem: r.mensagem,
      });
    }
    for (const p of igQ.data ?? []) {
      if (!p.agendado_para) continue;
      push(ymd(p.agendado_para), {
        id: `ig-${p.id}`,
        tipo: "post_ig",
        titulo: p.titulo,
        mensagem: p.legenda,
      });
    }
    return m;
  }, [q.data, igQ.data]);

  const modifiers = useMemo(() => {
    const mods: Record<string, Date[]> = {
      noticia: [],
      enquete: [],
      instagram: [],
      linkedin: [],
      post_ig: [],
    };
    for (const [k, arr] of byDay) {
      const [y, mo, d] = k.split("-").map(Number);
      const date = new Date(y, mo - 1, d);
      const tipos = new Set(arr.map((a) => a.tipo));
      for (const t of tipos) if (mods[t]) mods[t].push(date);
    }
    return mods;
  }, [byDay]);


  const dia = selected ? byDay.get(ymd(selected)) ?? [] : [];

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-2 flex justify-center">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            modifiers={modifiers}
            modifiersClassNames={{
              noticia: "ring-2 ring-[var(--tipo-noticia)]",
              enquete: "ring-2 ring-[var(--tipo-enquete)]",
              instagram: "ring-2 ring-[var(--tipo-instagram)]",
              linkedin: "ring-2 ring-[var(--tipo-linkedin)]",
            }}
            className="pointer-events-auto"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.keys(TIPO_LABEL).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: `var(--tipo-${t})` }}
            />
            {TIPO_LABEL[t]}
          </span>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selected
              ? selected.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "Selecione um dia"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum disparo nesse dia.</p>
          ) : (
            dia.map((it) => (
              <div key={it.id} className="p-3 rounded-lg border bg-card space-y-1">
                <Badge className={TIPO_CLASS[it.tipo] ?? ""}>{TIPO_LABEL[it.tipo] ?? it.tipo}</Badge>
                <p className="text-sm font-medium">{it.titulo || "(sem título)"}</p>
                {it.mensagem && it.mensagem !== it.titulo && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {it.mensagem}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- HELPERS ---------------- */
function Loading() {
  return (
    <div className="flex justify-center py-12 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}
function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="p-4 rounded-lg border border-destructive/40 bg-destructive/5 text-destructive text-sm">
      {(error as Error)?.message ?? "Erro"}
    </div>
  );
}
function EmptyBox({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
        {icon}
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
