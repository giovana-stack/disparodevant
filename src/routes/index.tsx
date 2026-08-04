/**
 * Execute esta instrucao no projeto: A última alteração no prompt ficou errada. Ela fixou "focar em benefícios e direitos do empresário" como regra fixa — isso está incorreto, porque cada notícia tem um ângulo diferente, não é sempre sobre benefícios. Substitua por esta regra genérica:
 * 
 * "A abertura da legenda (primeira ou segunda linha) deve ser o GANCHO mais chamativo do TÍTULO da notícia — o que tem mais potencial de prender atenção e gerar engajamento, seja qual for o assunto daquela notícia específica (pode ser um direito, um risco, um prazo, uma mudança, uma oportunidade, o que for — depende do título). Identifique qual é o ponto central que o título está comunicando e abra por ele. Detalhes técnicos, burocráticos, pré-requisitos, mecanismos ou processos que expliquem o 'como funciona' devem ficar no MEIO do texto, nunca na abertura. A abertura vende a ideia; o meio explica os detalhes; o fechamento reforça a importância."
 */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Newspaper,
  BarChart3,
  Link2,
  Instagram as InstagramIcon,
  LogOut,
  Loader2,
  Trash2,
  Send,
  Sparkles,
  Plus,
  X,
  MessageCircle,
  RefreshCw,
  Clock,
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
import { getAuthState, unlockApp, lockApp } from "@/lib/auth.functions";
import {
  listPendingNoticias,
  discardNoticia,
  dispararEnquete,
  dispararPost,
  buscarNovasNoticias,
} from "@/lib/rascunhos.functions";
import { gerarEnquete, gerarChamadaPost } from "@/lib/gemini.functions";
import { listPostagensPublicadas } from "@/lib/instagram.functions";
import { InstagramTab } from "@/components/InstagramTab";

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
            <TabsTrigger value="instagram" className="flex-col gap-0.5 py-2 text-[11px]">
              <InstagramIcon className="w-4 h-4" /> Instagram
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
          <TabsContent value="instagram" className="mt-4">
            <InstagramTab />
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
      console.error("Erro completo na busca:", e);
      const msg = (e as Error)?.message || JSON.stringify(e);
      toast.error(`Erro ao buscar notícias: ${msg}`, {
        duration: 10000, // Duração maior para o usuário conseguir ler o erro completo
      });
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
  onDiscard,
}: {
  rascunho: { id: string | number; titulo: string | null; mensagem: string | null; criado_em?: string | null; is_scheduled?: boolean };
  onDiscard: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <CardTitle className="text-sm leading-snug flex items-center gap-1.5">
            {rascunho.titulo || "Sem título"}
            {rascunho.is_scheduled && (
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            )}
          </CardTitle>
          {rascunho.criado_em && (
            <p className="text-xs text-muted-foreground">
              Coletada em: {new Date(rascunho.criado_em).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onDiscard();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-1" />
              Descartar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- ABA 2: ENQUETE ---------------- */
function EnqueteTab() {
  const qc = useQueryClient();
  const listPublicadasFn = useServerFn(listPostagensPublicadas);
  const gerarFn = useServerFn(gerarEnquete);
  const dispararFn = useServerFn(dispararEnquete);

  const noticiasQ = useQuery({
    queryKey: ["postagens-publicadas"],
    queryFn: () => listPublicadasFn(),
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
      const base = [noticia.titulo, noticia.legenda].filter(Boolean).join("\n\n");
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
          <Label>Baseada em um post publicado no Instagram</Label>
          <Select value={selecionada} onValueChange={setSelecionada}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um post..." />
            </SelectTrigger>
            <SelectContent>
              {(noticiasQ.data ?? []).map((n) => (
                <SelectItem key={String(n.id)} value={String(n.id)}>
                  {(n.titulo || n.legenda || "").slice(0, 80)}
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
