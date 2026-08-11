import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Trash2, Send, Calendar, XCircle, Clock } from "lucide-react";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listPostagensInstagram,
  enviarWebhookMake,
  cancelarAgendamento,
  excluirNoticiaOriginal,
  atualizarDataAgendamento,
} from "@/lib/instagram.functions";

export function AgendadosTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPostagensInstagram);
  const webhookFn = useServerFn(enviarWebhookMake);
  const cancelarFn = useServerFn(cancelarAgendamento);
  const excluirFn = useServerFn(excluirNoticiaOriginal);
  const atualizarFn = useServerFn(atualizarDataAgendamento);

  const q = useQuery({
    queryKey: ["postagens-instagram"],
    queryFn: () => listFn(),
  });

  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: string | number; date: string } | null>(null);

  if (q.isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  
  const items = (q.data ?? []).filter(p => p.status === "agendado");

  async function handlePublicarAgora(post: any) {
    setBusyId(post.id);
    try {
      await webhookFn({ 
        data: { 
          titulo: post.titulo || "", 
          imagem_fundo_url: post.imagem_url || "", 
          legenda: post.legenda || "",
          resumo_whats: post.resumo_whats || ""
        } 
      });
      // Marcar como publicado no banco local (cancelar o agendado)
      await cancelarFn({ data: { id: post.id, novoStatus: "publicado" } });
      toast.success("Post publicado com sucesso!");
      qc.invalidateQueries({ queryKey: ["postagens-instagram"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelar(id: string | number) {
    setBusyId(id);
    try {
      await cancelarFn({ data: { id } });
      toast.success("Agendamento cancelado");
      qc.invalidateQueries({ queryKey: ["postagens-instagram"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleExcluir(post: any) {
    if (!confirm("Isso excluirá a postagem agendada e a notícia original do sistema. Continuar?")) return;
    setBusyId(post.id);
    try {
      await excluirFn({ data: { id: post.id, rascunho_id: post.rascunho_id } });
      toast.success("Excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["postagens-instagram"] });
      qc.invalidateQueries({ queryKey: ["noticias-pendentes"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateDate() {
    if (!editingPost) return;
    setBusyId(editingPost.id);
    try {
      await atualizarFn({ 
        data: { 
          id: editingPost.id, 
          novaData: new Date(editingPost.date).toISOString() 
        } 
      });
      toast.success("Data atualizada");
      setEditingPost(null);
      qc.invalidateQueries({ queryKey: ["postagens-instagram"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
          Nenhuma postagem agendada.
        </div>
      ) : (
        items.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                {p.imagem_url && (
                  <div className="w-full sm:w-32 h-32 sm:h-auto bg-muted">
                    <img src={p.imagem_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4 flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-bold leading-tight">
                        {p.titulo}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full w-fit">
                        <Calendar className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">
                          {p.agendado_para 
                            ? format(new Date(p.agendado_para), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
                            : "Data não definida"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      className="text-[11px] h-8 px-2"
                      disabled={busyId === p.id}
                      onClick={() => handlePublicarAgora(p)}
                    >
                      {busyId === p.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                      Publicar agora
                    </Button>

                    <Dialog open={editingPost?.id === p.id} onOpenChange={(open) => !open && setEditingPost(null)}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-[11px] h-8 px-2"
                          onClick={() => setEditingPost({ id: p.id, date: p.agendado_para?.split('.')[0] || "" })}
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Mudar data
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Alterar data de postagem</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-3">
                          <Label>Nova data e hora</Label>
                          <Input 
                            type="datetime-local" 
                            value={editingPost?.date || ""}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => setEditingPost(prev => prev ? { ...prev, date: e.target.value } : null)}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditingPost(null)}>Cancelar</Button>
                          <Button onClick={handleUpdateDate} disabled={busyId === p.id}>
                            {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "Salvar"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="text-[11px] h-8 px-2"
                      disabled={busyId === p.id}
                      onClick={() => handleCancelar(p.id)}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Cancelar
                    </Button>

                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="text-[11px] h-8 px-2"
                      disabled={busyId === p.id}
                      onClick={() => handleExcluir(p)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Excluir notícia
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
