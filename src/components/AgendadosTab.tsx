import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Trash2, Send, Calendar, XCircle, Clock, BarChart3, Instagram } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listPostagensInstagram,
  enviarWebhookMake,
  cancelarAgendamento,
  excluirNoticiaOriginal,
  atualizarDataAgendamento,
} from "@/lib/instagram.functions";
import {
  listEnquetesAgendadas,
  cancelarEnqueteAgendada,
  atualizarDataEnquete,
  dispararEnqueteAgora,
} from "@/lib/rascunhos.functions";

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dataLegivel(iso: string | null | undefined) {
  if (!iso) return "Data nao definida";
  return format(new Date(iso), "dd 'de' MMMM 'as' HH:mm", { locale: ptBR });
}

type Item = {
  tipo: "post" | "enquete";
  id: string | number;
  quando: string | null;
  dado: any;
};

export function AgendadosTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPostagensInstagram);
  const webhookFn = useServerFn(enviarWebhookMake);
  const cancelarFn = useServerFn(cancelarAgendamento);
  const excluirFn = useServerFn(excluirNoticiaOriginal);
  const atualizarFn = useServerFn(atualizarDataAgendamento);

  const listEnquetesFn = useServerFn(listEnquetesAgendadas);
  const cancelarEnqueteFn = useServerFn(cancelarEnqueteAgendada);
  const atualizarEnqueteFn = useServerFn(atualizarDataEnquete);
  const dispararEnqueteFn = useServerFn(dispararEnqueteAgora);

  const q = useQuery({
    queryKey: ["postagens-instagram"],
    queryFn: () => listFn(),
  });

  const qe = useQuery({
    queryKey: ["enquetes-agendadas"],
    queryFn: () => listEnquetesFn(),
  });

  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [editando, setEditando] = useState<{ tipo: "post" | "enquete"; id: string | number; date: string } | null>(null);

  if (q.isLoading || qe.isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const posts = (q.data ?? []).filter((p: any) => p.status === "agendado");
  const enquetes = (qe.data ?? []) as any[];

  const itens: Item[] = [
    ...posts.map((p: any) => ({ tipo: "post" as const, id: p.id, quando: p.agendado_para, dado: p })),
    ...enquetes.map((e: any) => ({ tipo: "enquete" as const, id: e.id, quando: e.agendado_para, dado: e })),
  ].sort((a, b) => {
    const ta = a.quando ? new Date(a.quando).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.quando ? new Date(b.quando).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["postagens-instagram"] });
    qc.invalidateQueries({ queryKey: ["enquetes-agendadas"] });
  }

  async function rodar(id: string | number, fn: () => Promise<unknown>, msg: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(msg);
      invalidar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handlePublicarAgora(post: any) {
    await rodar(
      post.id,
      async () => {
        await webhookFn({
          data: {
            titulo: post.titulo || "",
            imagem_fundo_url: post.imagem_url || "",
            legenda: post.legenda || "",
            resumo_whats: post.resumo_whats || "",
          },
        });
        await cancelarFn({ data: { id: post.id, novoStatus: "publicado" } });
      },
      "Post publicado com sucesso!"
    );
  }

  async function handleExcluir(post: any) {
    if (!confirm("Isso excluira a postagem agendada e a noticia original do sistema. Continuar?")) return;
    await rodar(
      post.id,
      () => excluirFn({ data: { id: post.id, rascunho_id: post.rascunho_id } }),
      "Excluido com sucesso"
    );
    qc.invalidateQueries({ queryKey: ["noticias-pendentes"] });
  }

  async function salvarData() {
    if (!editando) return;
    const alvo = editando;
    await rodar(
      alvo.id,
      async () => {
        const novaData = new Date(alvo.date).toISOString();
        if (alvo.tipo === "post") {
          await atualizarFn({ data: { id: alvo.id, novaData } });
        } else {
          await atualizarEnqueteFn({ data: { id: alvo.id, novaData } });
        }
        setEditando(null);
      },
      "Data atualizada"
    );
  }

  return (
    <div className="space-y-3">
      {itens.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
          Nada agendado no momento.
        </div>
      ) : (
        itens.map((item) =>
          item.tipo === "post" ? (
            <Card key={"post-" + String(item.id)} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  {item.dado.imagem_url && (
                    <div className="w-full sm:w-32 h-32 sm:h-auto bg-muted">
                      <img src={item.dado.imagem_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 flex-1 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                        <Instagram className="w-3 h-3" /> Post
                      </div>
                      <CardTitle className="text-sm font-bold leading-tight">{item.dado.titulo}</CardTitle>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full w-fit">
                        <Calendar className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">{dataLegivel(item.quando)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="text-[11px] h-8 px-2"
                        disabled={busyId === item.id}
                        onClick={() => handlePublicarAgora(item.dado)}
                      >
                        {busyId === item.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Send className="w-3 h-3 mr-1" />
                        )}
                        Publicar agora
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] h-8 px-2"
                        onClick={() => setEditando({ tipo: "post", id: item.id, date: toLocalInput(item.quando) })}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Mudar data
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-[11px] h-8 px-2"
                        disabled={busyId === item.id}
                        onClick={() => rodar(item.id, () => cancelarFn({ data: { id: item.id } }), "Agendamento cancelado")}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancelar
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-[11px] h-8 px-2"
                        disabled={busyId === item.id}
                        onClick={() => handleExcluir(item.dado)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Excluir noticia
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={"enquete-" + String(item.id)}>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                    <BarChart3 className="w-3 h-3" /> Enquete
                  </div>
                  <CardTitle className="text-sm font-bold leading-tight">{item.dado.titulo}</CardTitle>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full w-fit">
                    <Calendar className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase">{dataLegivel(item.quando)}</span>
                  </div>
                  {Array.isArray(item.dado.poll_opcoes) && item.dado.poll_opcoes.length > 0 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      {item.dado.poll_opcoes.join(" / ")}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    className="text-[11px] h-8 px-2"
                    disabled={busyId === item.id}
                    onClick={() => rodar(item.id, () => dispararEnqueteFn({ data: { id: item.id } }), "Enquete disparada!")}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Send className="w-3 h-3 mr-1" />
                    )}
                    Agora
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-8 px-2"
                    onClick={() => setEditando({ tipo: "enquete", id: item.id, date: toLocalInput(item.quando) })}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Mudar data
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-[11px] h-8 px-2"
                    disabled={busyId === item.id}
                    onClick={() => rodar(item.id, () => cancelarEnqueteFn({ data: { id: item.id } }), "Agendamento cancelado")}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )
      )}

      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar data</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label>Nova data e hora</Label>
            <Input
              type="datetime-local"
              value={editando?.date || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                }
              }}
              onChange={(e) => setEditando((prev) => (prev ? { ...prev, date: e.target.value } : null))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarData} disabled={!editando?.date || busyId === editando?.id}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
