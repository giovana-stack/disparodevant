import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, CalendarClock, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { listSentNoticias, marcarRascunhoEnviado } from "@/lib/rascunhos.functions";
import { gerarLegendaInstagram, gerarResumoWhatsApp } from "@/lib/gemini.functions";
import {
  uploadImagemPost,
  salvarPostagemInstagram,
  enviarWebhookMake,
} from "@/lib/instagram.functions";

const VERDE_ESCURO = "#192A25";
const VERDE_TAG = "#2ABFBF";
const OVERLAY_COR = "rgba(25, 42, 37, 0.75)";





export function InstagramTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSentNoticias);
  const legendaFn = useServerFn(gerarLegendaInstagram);
  const uploadFn = useServerFn(uploadImagemPost);
  const resumoFn = useServerFn(gerarResumoWhatsApp);
  const salvarFn = useServerFn(salvarPostagemInstagram);
  const webhookFn = useServerFn(enviarWebhookMake);
  const marcarEnviadoFn = useServerFn(marcarRascunhoEnviado);

  const noticiasQ = useQuery({ queryKey: ["noticias-selecionaveis"], queryFn: () => listFn() });

  const [selecionada, setSelecionada] = useState("");
  const [manual, setManual] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [legenda, setLegenda] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [resumo, setResumo] = useState("");
  const [agendadoPara, setAgendadoPara] = useState("");
  const [mostrarAgendar, setMostrarAgendar] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [salvando, setSalvando] = useState<null | "agendar" | "agora">(null);


  const previewRef = useRef<HTMLDivElement>(null);

  const noticia = (noticiasQ.data ?? []).find((n: any) => String(n.id) === selecionada);

  function escolherNoticia(id: string) {
    setSelecionada(id);
    setManual(false);
    const n = (noticiasQ.data ?? []).find((x: any) => String(x.id) === id);
    setTitulo(n?.titulo || "");
    setImagemUrl(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        // Converte para JPEG com 90% de qualidade
        const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setImagem(jpegDataUrl);
        setImagemUrl(null);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  }

  async function gerarLegenda() {
    if (!titulo.trim()) return;
    setGerando(true);
    try {
      const r = await legendaFn({ data: { titulo, mensagem: noticia?.mensagem || "" } });
      setLegenda(r.legenda);
      toast.success("Legenda gerada — revise antes de agendar");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  async function gerarResumo() {
    if (!titulo.trim()) return;
    setGerandoResumo(true);
    try {
      const r = await resumoFn({ data: { titulo, legenda } });
      setResumo(r.resumo);
      toast.success("Resumo gerado!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerandoResumo(false);
    }
  }

  async function subirImagemFundo(): Promise<string> {
    if (imagemUrl) return imagemUrl;
    if (!imagem) throw new Error("Envie a imagem de fundo");
    const r = await uploadFn({ data: { dataUrl: imagem } });
    setImagemUrl(r.url);
    return r.url;
  }

  function limpar() {
    setLegenda("");
    setResumo("");
    setImagem(null);
    setImagemUrl(null);
    setAgendadoPara("");
    setMostrarAgendar(false);
    setSelecionada("");
    setManual(false);
    setTitulo("");
  }

  async function salvar(modo: "agendar" | "agora") {
    if (modo === "agendar" && !agendadoPara) {
      toast.error("Escolha data e hora");
      return;
    }
    if (!titulo.trim()) {
      toast.error("Digite ou selecione um título");
      return;
    }
    if (!legenda.trim()) {
      toast.error("Gere ou escreva a legenda");
      return;
    }
    setSalvando(modo);
    try {
      const url = await subirImagemFundo();
      if (modo === "agora") {
        await webhookFn({ data: { titulo: titulo.trim(), imagem_fundo_url: url, legenda: legenda.trim(), resumo_whats: resumo.trim() } });
        if (noticia?.id) {
          await marcarEnviadoFn({ data: { id: noticia.id } });
        }
      } else {
        await salvarFn({
          data: {
            titulo,
            imagem_url: url,
            legenda,
            resumo_whats: resumo,
            agendado_para: new Date(agendadoPara).toISOString(),
            status: "agendado",
            rascunho_id: noticia?.id ?? null,
          },
        });
      }
      toast.success(modo === "agora" ? "Post publicado com sucesso!" : "Postagem agendada!");
      qc.invalidateQueries({ queryKey: ["postagens-instagram"] });
      qc.invalidateQueries({ queryKey: ["noticias-selecionaveis"] });
      limpar();
    } catch (e) {
      toast.error((e as Error).message || "Falha ao publicar");
    } finally {
      setSalvando(null);
    }
  }



  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Criar post de Instagram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Selecione uma notícia</Label>
            <Select value={selecionada} onValueChange={escolherNoticia}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma notícia..." />
              </SelectTrigger>
              <SelectContent>
                {(noticiasQ.data ?? []).map((n: any) => (
                  <SelectItem key={String(n.id)} value={String(n.id)}>
                    <div className="flex flex-col">
                      <span>{(n.titulo || n.mensagem || "").slice(0, 80)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-xs text-muted-foreground">ou crie manualmente</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ig-titulo-manual">Título da notícia</Label>
            <Input
              id="ig-titulo-manual"
              value={manual ? titulo : ""}
              placeholder="Digite o título do post..."
              onChange={(e) => {
                setManual(true);
                setSelecionada("");
                setTitulo(e.target.value);
              }}
            />
          </div>

          {(selecionada || (manual && titulo.trim())) && (
            <div className="space-y-1.5">
              <Label htmlFor="ig-img">Envie a imagem de fundo</Label>
              <Input id="ig-img" type="file" accept="image/*" onChange={onFile} />
            </div>
          )}
        </CardContent>
      </Card>

      {(selecionada || (manual && titulo.trim())) && imagem && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prévia da arte (clique no título para editar)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="w-full overflow-x-auto flex justify-center">
              <div
                ref={previewRef}
                style={{
                  position: "relative",
                  width: 540, // 1080 / 2
                  height: 675, // 1350 / 2
                  flex: "0 0 auto",
                  overflow: "hidden",
                  fontFamily: "'Montserrat', Arial, sans-serif",
                  background: VERDE_ESCURO,
                  border: `12px solid ${VERDE_TAG}`,
                }}
              >
                {/* Camada 1: fundo (imagem do usuário) */}
                <img
                  src={imagem}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                {/* Camada 2: overlay escuro */}
                <div style={{ position: "absolute", inset: 0, background: OVERLAY_COR }} />

                {/* Camada 3: tag NOTÍCIA topo central */}
                <div
                  style={{
                    position: "absolute",
                    top: 40,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      background: VERDE_TAG,
                      color: "#FFFFFF",
                      fontFamily: "'Montserrat', Arial, sans-serif",
                      fontWeight: 800,
                      fontSize: 16,
                      letterSpacing: 2,
                      padding: "6px 20px",
                      borderRadius: 999,
                    }}
                  >
                    NOTÍCIA
                  </span>
                </div>

                {/* Camada 4: Título centralizado (levemente acima do meio) */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 40px",
                  }}
                >
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setTitulo(e.currentTarget.innerText)}
                    style={{
                      color: "#FFFFFF",
                      fontFamily: "'Montserrat', Arial, sans-serif",
                      fontWeight: 900,
                      fontSize: 36,
                      lineHeight: 1.1,
                      textAlign: "center",
                      textTransform: "uppercase",
                      outline: "none",
                      width: "100%",
                    }}
                  >
                    {titulo}
                  </div>
                </div>

                {/* Camada 5: Rodapé Devant */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 40,
                    left: 0,
                    right: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Linhas decorativas + ícone */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 16,
                      width: "100%",
                      padding: "0 60px",
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.3)" }} />
                    <img
                      src="https://adgcnounhstuqwpvfpgp.supabase.co/storage/v1/object/public/imagens/isotipo-branco.png"
                      alt=""
                      crossOrigin="anonymous"
                      style={{ width: 32, height: 32, objectFit: "contain" }}
                    />
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.3)" }} />
                  </div>
                  
                  {/* Texto DEVANT */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                    <div
                      style={{
                        color: "#FFFFFF",
                        fontFamily: "'Montserrat', Arial, sans-serif",
                        fontWeight: 800,
                        fontSize: 20,
                        letterSpacing: 4,
                        lineHeight: 1,
                      }}
                    >
                      DEVANT
                    </div>
                    <div
                      style={{
                        color: "#FFFFFF",
                        fontFamily: "'Montserrat', Arial, sans-serif",
                        fontWeight: 400,
                        fontSize: 10,
                        letterSpacing: 1,
                        opacity: 0.8,
                      }}
                    >
                      SOLUÇÕES TRIBUTÁRIAS
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ig-legenda">Legenda do Instagram</Label>
              <Textarea
                id="ig-legenda"
                rows={7}
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
                placeholder="Escreva ou gere a legenda..."
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={gerando || !titulo.trim()}
                onClick={gerarLegenda}
              >
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar legenda com IA"}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ig-resumo">Resumo para WhatsApp</Label>
              <Textarea
                id="ig-resumo"
                rows={4}
                value={resumo}
                onChange={(e) => setResumo(e.target.value)}
                placeholder="Resumo que será enviado..."
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={gerandoResumo || !titulo.trim()}
                onClick={gerarResumo}
              >
                {gerandoResumo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar resumo WhatsApp"}
              </Button>
            </div>

            {mostrarAgendar && (
              <div className="space-y-1.5">
                <Label htmlFor="ig-data">Agendar para</Label>
                <Input
                  id="ig-data"
                  type="datetime-local"
                  value={agendadoPara}
                  onChange={(e) => setAgendadoPara(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {mostrarAgendar ? (
                <Button
                  variant="outline"
                  disabled={salvando !== null || !agendadoPara}
                  onClick={() => salvar("agendar")}
                >
                  {salvando === "agendar" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CalendarClock className="w-4 h-4 mr-1" /> Confirmar agendamento
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={salvando !== null}
                  onClick={() => setMostrarAgendar(true)}
                >
                  <CalendarClock className="w-4 h-4 mr-1" /> Agendar
                </Button>
              )}
              <Button disabled={salvando !== null} onClick={() => salvar("agora")}>
                {salvando === "agora" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" /> Publicar agora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


    </div>
  );
}
